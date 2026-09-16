const express = require("express");
const router = express.Router();
const { ai, MODEL_NAME } = require("../config/googleAI");
const { getCVText } = require("../services/cvService");
const { mentionsMe } = require("../utils/nameMatcher");
const auth = require("../middleware/auth");
const Message = require("../models/Message");

// Try the primary model first; if it's overloaded, fall back to these in order.
const FALLBACK_MODELS = [
  MODEL_NAME,
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash-lite",
].filter((v, i, arr) => v && arr.indexOf(v) === i); // dedupe, drop falsy

const MAX_RETRIES = 1; // per-model retries — kept low since we now fall back across models too
const BASE_DELAY_MS = 800;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(err) {
  // Google SDK surfaces status either as err.status or inside err.message JSON
  const status = err?.status || err?.code;
  const msg = err?.message || "";
  return (
    status === 503 ||
    status === "UNAVAILABLE" ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("503") ||
    msg.includes("high demand")
  );
}

async function withRetry(fn, { retries = MAX_RETRIES, baseDelay = BASE_DELAY_MS } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === retries) {
        throw err;
      }
      const delay = baseDelay * Math.pow(2, attempt); // 0.8s, 1.6s...
      console.warn(
        `Gemini call failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms:`,
        err.message
      );
      await sleep(delay);
    }
  }
  throw lastErr;
}

// Tries each model in FALLBACK_MODELS in order (with a couple of quick
// retries per model), moving to the next model as soon as one is
// consistently unavailable, instead of hammering the same overloaded model.
async function withModelFallback(makeChatAndCall) {
  let lastErr;
  for (const model of FALLBACK_MODELS) {
    try {
      const result = await withRetry(() => makeChatAndCall(model));
      if (model !== FALLBACK_MODELS[0]) {
        console.warn(`Served using fallback model: ${model}`);
      }
      return result;
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err)) throw err;
      console.warn(`Model ${model} unavailable, trying next fallback...`);
    }
  }
  throw lastErr;
}

function getSystemPrompt() {
  return `
You are shamirbot, an AI assistant created by Shahmir (Shahmeer Zubair). Always respond helpfully and engagingly.
If the user asks about Shahmir / Shahmeer / Zubair (e.g., "who is Shahmir?", "tell me about yourself" if referring to the creator, portfolio, CV, or similar), provide detailed information extracted from Shahmir's CV below, and always include his portfolio link when relevant:

Portfolio: https://shahmeer-zubair-portfolio.vercel.app/

${getCVText()}

Structure the response with bullet points for experience, skills, education, projects, and other relevant details. For other questions, answer normally using your knowledge.
`;
}

router.get("/history", auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const history = await Message.find({ userId }).sort("timestamp");
    res.json(
      history.map((m) => ({
        role: m.role,
        content: m.content,
        id: m._id.toString(),
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

router.post("/", auth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message required" });

    const userId = req.user.userId;
    const history = await Message.find({ userId }).sort("timestamp");
    const prevMessages = history.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    }));

    let userContent = message;
    if (mentionsMe(message)) {
      userContent = `Here is Shahmir's CV:\n${getCVText()}\n\nPortfolio: https://shahmeer-zubair-portfolio.vercel.app/\n\nUser message:\n${message}`;
    }

    const result = await withModelFallback((model) => {
      const chat = ai.chats.create({
        model,
        history: prevMessages,
        config: { systemInstruction: getSystemPrompt() },
      });
      return chat.sendMessage({ message: userContent });
    });
    const responseText = result.text;

    const userMsg = new Message({ userId, role: "user", content: message });
    await userMsg.save();

    const assistantMsg = new Message({
      userId,
      role: "shamirbot",
      content: responseText,
    });
    await assistantMsg.save();

    res.json({ text: responseText });
  } catch (err) {
    console.error(err);
    const status = isRetryable(err) ? 503 : 500;
    res.status(status).json({
      error:
        status === 503
          ? "The model is busy right now. Please try again in a moment."
          : "Failed to generate response",
    });
  }
});

router.post("/stream", auth, async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  try {
    const { message } = req.body;
    if (!message) {
      res.write(`data: ${JSON.stringify({ error: "Message required" })}\n\n`);
      return res.end();
    }

    const userId = req.user.userId;
    const history = await Message.find({ userId }).sort("timestamp");
    const prevMessages = history.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    }));

    let userContent = message;
    if (mentionsMe(message)) {
      userContent = `Here is Shahmir's CV:\n${getCVText()}\n\nPortfolio: https://shahmeer-zubair-portfolio.vercel.app/\n\nUser message:\n${message}`;
    }

    // Fallback across models only applies to *opening* the stream. Once
    // tokens start flowing we can't safely retry/switch without risking
    // duplicated output, so a failure mid-stream is reported as-is.
    const streaming = await withModelFallback((model) => {
      const chat = ai.chats.create({
        model,
        history: prevMessages,
        config: { systemInstruction: getSystemPrompt() },
      });
      return chat.sendMessageStream({ message: userContent });
    });

    let fullResponse = "";
    for await (const chunk of streaming) {
      const chunkText = chunk.text;
      if (chunkText) {
        fullResponse += chunkText;
        res.write(`data: ${JSON.stringify({ delta: chunkText })}\n\n`);
      }
    }

    const userMsg = new Message({ userId, role: "user", content: message });
    await userMsg.save();

    const assistantMsg = new Message({
      userId,
      role: "shamirbot",
      content: fullResponse,
    });
    await assistantMsg.save();

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error(err);
    const friendly = isRetryable(err)
      ? "The model is busy right now. Please try again in a moment."
      : err.message || "stream_error";
    try {
      res.write(`data: ${JSON.stringify({ error: friendly })}\n\n`);
      res.end();
    } catch {}
  }
});

module.exports = router;