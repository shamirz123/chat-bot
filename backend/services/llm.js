// Retry + model-fallback helpers for Gemini calls (extracted from the chat route

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(err) {
  const status = err?.status || err?.code;
  const msg = err?.message || "";
  return (
    status === 503 ||
    status === 429 ||
    status === "UNAVAILABLE" ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("503") ||
    msg.includes("high demand")
  );
}

async function withRetry(
  fn,
  { retries = 1, baseDelay = 800, wait = sleep, log = console.warn } = {},
) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === retries) throw err;
      const delay = baseDelay * 2 ** attempt;
      log(
        `Gemini call failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms:`,
        err.message,
      );
      await wait(delay);
    }
  }
  throw lastErr;
}

// Tries each model in order, moving on as soon as one is consistently
// unavailable instead of hammering the same overloaded model.
async function withModelFallback(models, call, retryOpts = {}) {
  const log = retryOpts.log || console.warn;
  let lastErr;
  for (const model of models) {
    try {
      const result = await withRetry(() => call(model), retryOpts);
      if (model !== models[0]) log(`Served using fallback model: ${model}`);
      return result;
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err)) throw err;
      log(`Model ${model} unavailable, trying next fallback...`);
    }
  }
  throw lastErr;
}

module.exports = { isRetryable, withRetry, withModelFallback, sleep };
