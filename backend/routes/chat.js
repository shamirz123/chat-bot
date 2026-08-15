const express = require("express");
const router = express.Router();
const { ai, MODEL_NAME } = require("../config/googleAI");
const { getCVText } = require("../services/cvService");
const { mentionsMe } = require("../utils/nameMatcher");
const auth = require("../middleware/auth");
const Message = require("../models/Message");

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

    const chat = ai.chats.create({
      model: MODEL_NAME,
      history: prevMessages,
      config: { systemInstruction: getSystemPrompt() },
    });

    let userContent = message;
    if (mentionsMe(message)) {
      userContent = `Here is Shahmir's CV:\n${getCVText()}\n\nPortfolio: https://shahmeer-zubair-portfolio.vercel.app/\n\nUser message:\n${message}`;
    }

    const result = await chat.sendMessage({ message: userContent });
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
    res.status(500).json({ error: "Failed to generate response" });
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

    const chat = ai.chats.create({
      model: MODEL_NAME,
      history: prevMessages,
      config: { systemInstruction: getSystemPrompt() },
    });

    let userContent = message;
    if (mentionsMe(message)) {
      userContent = `Here is Shahmir's CV:\n${getCVText()}\n\nPortfolio: https://shahmeer-zubair-portfolio.vercel.app/\n\nUser message:\n${message}`;
    }

    const streaming = await chat.sendMessageStream({ message: userContent });

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
    try {
      res.write(`data: ${JSON.stringify({ error: err.message || "stream_error" })}\n\n`);
      res.end();
    } catch {}
  }
});

module.exports = router;