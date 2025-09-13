const express = require("express");
const router = express.Router();
const { genAI } = require("../config/googleAI");
const { getCVText } = require("../services/cvService");
const { mentionsMe } = require("../utils/nameMatcher");

// Generate system prompt dynamically
function getSystemPrompt() {
  return `
You are Shaz, an AI assistant created by Shahmir. Always respond helpfully and engagingly.
If the user asks about Shahmir (e.g., "who is Shahmir?", "tell me about yourself" if referring to the creator, or similar), provide detailed information extracted from Shahmir's CV below:

${getCVText()}

Structure the response with bullet points for experience, skills, education, projects, and other relevant details. For other questions, answer normally using your knowledge.
`;
}

// Non-streaming chat
router.post("/", async (req, res) => {
  try {
    const { messages = [] } = req.body;
    const model = genAI.getGenerativeModel({ model: process.env.MODEL_NAME });

    const fullPrompt =
      getSystemPrompt() +
      "\n\n" +
      messages
        .map((m) => {
          let content = m.content;
          if (m.role === "user" && mentionsMe(m.content)) {
            content = `Here is Shahmir's CV:\n${getCVText()}\n\nUser message:\n${content}`;
          }
          return `${m.role.toUpperCase()}: ${content}`;
        })
        .join("\n\n");

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
    });

    res.json({ text: result.response.text() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate response" });
  }
});

// Streaming chat
router.post("/stream", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  try {
    const { messages = [] } = req.body;
    const model = genAI.getGenerativeModel({ model: process.env.MODEL_NAME });

    const fullPrompt =
      getSystemPrompt() +
      "\n\n" +
      messages
        .map((m) => {
          let content = m.content;
          if (m.role === "user" && mentionsMe(m.content)) {
            content = `Here is Shahmir's CV:\n${getCVText()}\n\nUser message:\n${content}`;
          }
          return `${m.role.toUpperCase()}: ${content}`;
        })
        .join("\n\n");

    const streaming = await model.generateContentStream({
      contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
    });

    for await (const chunk of streaming.stream) {
      const chunkText = chunk.text();
      if (chunkText)
        res.write(`data: ${JSON.stringify({ delta: chunkText })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error(err);
    try {
      res.write(`data: ${JSON.stringify({ error: "stream_error" })}\n\n`);
      res.end();
    } catch {}
  }
});

module.exports = router;
