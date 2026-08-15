const { GoogleGenAI } = require("@google/genai");
const dotenv = require("dotenv");

dotenv.config();

// gemini-1.5-flash / gemini-2.0-flash are shut down; use a current Flash model.
const MODEL_NAME = process.env.MODEL_NAME || "gemini-2.5-flash";
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

module.exports = { ai, MODEL_NAME };