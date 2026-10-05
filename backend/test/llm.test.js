require("./helpers");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { isRetryable, withRetry, withModelFallback } = require("../services/llm");

const busy = () => Object.assign(new Error("model overloaded"), { status: 503 });
const opts = { wait: async () => {}, log: () => {} };

test("isRetryable recognises overload, quota and 'high demand' errors but not others", () => {
  assert.ok(isRetryable({ status: 503 }));
  assert.ok(isRetryable({ status: 429 }));
  assert.ok(isRetryable(new Error('{"status":"UNAVAILABLE"}')));
  assert.ok(isRetryable(new Error("This model is currently experiencing high demand")));
  assert.ok(!isRetryable(new Error("API key not valid")));
  assert.ok(!isRetryable({ status: 400 }));
  assert.ok(!isRetryable(undefined));
});

test("withRetry retries a transient failure with exponential backoff", async () => {
  const delays = [];
  let calls = 0;
  const result = await withRetry(
    async () => {
      if (++calls < 3) throw busy();
      return "ok";
    },
    { retries: 2, baseDelay: 100, wait: async (ms) => delays.push(ms), log: () => {} }
  );
  assert.equal(result, "ok");
  assert.equal(calls, 3);
  assert.deepEqual(delays, [100, 200]);
});

test("withRetry does not retry non-retryable errors", async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(async () => {
      calls++;
      throw new Error("bad request");
    }, opts),
    /bad request/
  );
  assert.equal(calls, 1);
});

test("withModelFallback moves to the next model when one stays unavailable", async () => {
  const tried = [];
  const result = await withModelFallback(
    ["primary", "backup"],
    async (model) => {
      tried.push(model);
      if (model === "primary") throw busy();
      return `served by ${model}`;
    },
    { ...opts, retries: 1 }
  );
  assert.equal(result, "served by backup");
  assert.deepEqual(tried, ["primary", "primary", "backup"]);
});

test("withModelFallback stops immediately on a non-retryable error", async () => {
  const tried = [];
  await assert.rejects(
    withModelFallback(
      ["a", "b"],
      async (m) => {
        tried.push(m);
        throw new Error("invalid api key");
      },
      opts
    ),
    /invalid api key/
  );
  assert.deepEqual(tried, ["a"]);
});

test("withModelFallback throws the last error when every model is unavailable", async () => {
  await assert.rejects(
    withModelFallback(
      ["a", "b"],
      async () => {
        throw busy();
      },
      { ...opts, retries: 0 }
    ),
    /overloaded/
  );
});
