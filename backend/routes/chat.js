const express = require("express");
const { ai, MODEL_NAME } = require("../config/googleAI");
const auth = require("../middleware/auth");
const { validate, schemas } = require("../middleware/validate");
const { chatLimiter } = require("../middleware/rateLimit");
const Message = require("../models/Message");
const { isRetryable, withModelFallback } = require("../services/llm");
const { ensureCVIndexed, retrieve } = require("../services/ragService");
const {
  SYSTEM_PROMPT,
  MAX_HISTORY_MESSAGES,
  buildUserTurn,
  buildRetrievalQuery,
  toGeminiHistory,
  toPublicSources,
} = require("../services/promptBuilder");

const router = express.Router();

// Try the primary model first; if it's overloaded, fall back to these in order.
const FALLBACK_MODELS = [
  MODEL_NAME,
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash-lite",
].filter((v, i, arr) => v && arr.indexOf(v) === i);

const BUSY_MESSAGE = "The model is busy right now. Please try again in a moment.";

/** Loads recent history and retrieves grounding context for this question. */
async function prepareTurn(userId, message) {
  await ensureCVIndexed().catch((err) =>
    console.warn("CV indexing failed:", err.message)
  );

  const recent = (
    await Message.find({ userId })
      .sort({ timestamp: -1 })
      .limit(MAX_HISTORY_MESSAGES)
      .lean()
  ).reverse();

  let sources = [];
  try {
    sources = await retrieve(userId, buildRetrievalQuery(message, recent));
  } catch (err) {
    // Chat still works without grounding; it just answers from general knowledge.
    console.warn("Retrieval failed, continuing without context:", err.message);
  }

  return {
    history: toGeminiHistory(recent),
    userContent: buildUserTurn(message, sources),
    publicSources: toPublicSources(sources),
  };
}

async function saveTurn(userId, message, response, sources) {
  const now = Date.now();
  const docs = [{ userId, role: "user", content: message, timestamp: new Date(now) }];
  if (response) {
    docs.push({
      userId,
      role: "shamirbot",
      content: response,
      sources: sources.length ? sources : undefined,
      timestamp: new Date(now + 1),
    });
  }
  await Message.insertMany(docs);
}

const openChat = (model, history) =>
  ai.chats.create({ model, history, config: { systemInstruction: SYSTEM_PROMPT } });

router.get("/history", auth, async (req, res) => {
  try {
    const history = await Message.find({ userId: req.user.userId })
      .sort("timestamp")
      .lean();
    res.json(
      history.map((m) => ({
        role: m.role,
        content: m.content,
        id: m._id.toString(),
        ...(m.sources?.length ? { sources: m.sources } : {}),
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

router.post("/", auth, chatLimiter, validate(schemas.chat), async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user.userId;
    const { history, userContent, publicSources } = await prepareTurn(userId, message);

    const result = await withModelFallback(FALLBACK_MODELS, (model) =>
      openChat(model, history).sendMessage({ message: userContent })
    );

    await saveTurn(userId, message, result.text, publicSources);
    res.json({ text: result.text, sources: publicSources });
  } catch (err) {
    console.error(err);
    const busy = isRetryable(err);
    res.status(busy ? 503 : 500).json({
      error: busy ? BUSY_MESSAGE : "Failed to generate response",
    });
  }
});

router.post("/stream", auth, chatLimiter, validate(schemas.chat), async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`);

  let clientGone = false;
  res.on("close", () => {
    if (!res.writableFinished) clientGone = true;
  });

  try {
    const { message } = req.body;
    const userId = req.user.userId;
    const { history, userContent, publicSources } = await prepareTurn(userId, message);

    // Citations go out first so the UI can show them while the answer streams.
    if (publicSources.length) send({ sources: publicSources });

    // Fallback across models only applies to *opening* the stream. Once tokens
    // are flowing we can't switch models without duplicating output, so a
    // mid-stream failure is reported as-is.
    const stream = await withModelFallback(FALLBACK_MODELS, (model) =>
      openChat(model, history).sendMessageStream({ message: userContent })
    );

    let fullResponse = "";
    for await (const chunk of stream) {
      if (clientGone) break; // user pressed Stop: stop pulling tokens
      if (chunk.text) {
        fullResponse += chunk.text;
        send({ delta: chunk.text });
      }
    }

    await saveTurn(userId, message, fullResponse, publicSources);
    if (!clientGone) {
      send({ done: true });
      res.end();
    }
  } catch (err) {
    console.error(err);
    const friendly = isRetryable(err) ? BUSY_MESSAGE : "Failed to generate response";
    if (!res.writableEnded) {
      send({ error: friendly });
      res.end();
    }
  }
});

module.exports = router;
