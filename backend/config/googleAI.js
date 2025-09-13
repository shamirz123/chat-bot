const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");

dotenv.config();

const MODEL_NAME = process.env.MODEL_NAME || "gemini-1.5-flash";
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

module.exports = { genAI, MODEL_NAME };
