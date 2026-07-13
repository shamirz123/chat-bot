const { GoogleGenAI } = require("@google/genai");
const dotenv = require("dotenv");

dotenv.config();

const MODEL_NAME = process.env.MODEL_NAME || "gemini-flash-latest";
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

module.exports = { ai, MODEL_NAME };