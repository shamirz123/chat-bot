const express = require("express");
const router = express.Router();
const { genAI } = require("../config/googleAI");
const { getCVText } = require("../services/cvService");
const { mentionsMe } = require("../utils/nameMatcher");
const auth = require("../middleware/auth");
const Message = require("../models/Message");

function getSystemPrompt() {
  return `
You are Shaz, an AI assistant created by Shahmir. Always respond helpfully and engagingly.
If the user asks about Shahmir (e.g., "who is Shahmir?", "tell me about yourself" if referring to the creator, or similar), provide detailed information extracted from Shahmir's CV below:

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
    const { message } = req.body; // Now expects { message: string }
    if (!message) return res.status(400).json({ error: "Message required" });

    const userId = req.user.userId;
    const history = await Message.find({ userId }).sort("timestamp");
    const prevMessages = history.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    }));

    const model = genAI.getGenerativeModel({
      model: process.env.MODEL_NAME,
      systemInstruction: getSystemPrompt(),
    });

    const chat = model.startChat({ history: prevMessages });

    let userContent = message;
    if (mentionsMe(message)) {
      userContent = `Here is Shahmir's CV:\n${getCVText()}\n\nUser message:\n${message}`;
    }

    const result = await chat.sendMessage(userContent);

    const responseText = result.response.text();

    // Save user message
    const userMsg = new Message({ userId, role: "user", content: message });
    await userMsg.save();

    // Save assistant message
    const assistantMsg = new Message({
      userId,
      role: "Shaz",
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
    const { message } = req.body; // Now expects { message: string }
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

    const model = genAI.getGenerativeModel({
      model: process.env.MODEL_NAME,
      systemInstruction: getSystemPrompt(),
    });

    const chat = model.startChat({ history: prevMessages });

    let userContent = message;
    if (mentionsMe(message)) {
      userContent = `Here is Shahmir's CV:\n${getCVText()}\n\nUser message:\n${message}`;
    }

    const streaming = await chat.sendMessageStream(userContent);

    let fullResponse = "";
    for await (const chunk of streaming.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        fullResponse += chunkText;
        res.write(`data: ${JSON.stringify({ delta: chunkText })}\n\n`);
      }
    }

    // Save user message
    const userMsg = new Message({ userId, role: "user", content: message });
    await userMsg.save();

    // Save assistant message
    const assistantMsg = new Message({
      userId,
      role: "Shaz",
      content: fullResponse,
    });
    await assistantMsg.save();

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
