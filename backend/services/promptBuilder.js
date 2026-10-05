const MAX_HISTORY_MESSAGES = 20;
const MAX_EXCERPT_CHARS = 280;

const PORTFOLIO_URL = "https://shahmeer-zubair-portfolio.vercel.app/";

const SYSTEM_PROMPT = `You are AskShamir, an AI assistant created by Shahmir (Shahmeer Zubair).
Be helpful, accurate and concise. Use Markdown for structure when it helps.

"Context" excerpts may be attached to a question. They are found automatically by similarity search, so they are often irrelevant. Decide whether they help:
- Question about Shahmir (his CV, skills, projects, experience, education, contact): answer from the excerpts and cite only the ones you actually used, e.g. [1] or [2][3].
- General question (facts, geography, maths, coding, advice, writing) that has nothing to do with Shahmir or the uploaded documents: ignore the excerpts completely. Answer directly and briefly like a normal assistant. Do not mention the excerpts, do not say they lack the answer, and do not cite anything.
- Question about Shahmir or an uploaded document whose answer is not in the excerpts: say you don't have that information. Never invent details about Shahmir.
- Never cite an excerpt you did not use.
When no context is provided, answer normally from your own knowledge.
Include Shahmir's portfolio link (${PORTFOLIO_URL}) when you talk about him or his work.`;

function buildContextBlock(sources) {
  if (!sources.length) return "";
  const body = sources
    .map((s, i) => `[${i + 1}] (${s.docName})\n${s.text}`)
    .join("\n\n");
  return `Context:\n${body}`;
}

function buildUserTurn(message, sources) {
  const context = buildContextBlock(sources);
  return context ? `${context}\n\nQuestion: ${message}` : message;
}

// Gemini history must alternate roles starting with "user"; keep the most
function toGeminiHistory(messages, limit = MAX_HISTORY_MESSAGES) {
  const mapped = messages.slice(-limit).map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.content }],
  }));
  while (mapped.length && mapped[0].role !== "user") mapped.shift();
  return mapped;
}

function buildRetrievalQuery(message, previousMessages, shortLimit = 40) {
  if (message.length >= shortLimit) return message;
  const lastQuestion = [...previousMessages]
    .reverse()
    .find((m) => m.role === "user");
  return lastQuestion ? `${lastQuestion.content}\n${message}` : message;
}

// Trimmed, client-safe view of retrieved chunks (no embeddings).
function toPublicSources(sources) {
  return sources.map((s, i) => ({
    n: i + 1,
    docName: s.docName,
    excerpt:
      s.text.length > MAX_EXCERPT_CHARS
        ? `${s.text.slice(0, MAX_EXCERPT_CHARS).trimEnd()}…`
        : s.text,
    score: Number(s.score.toFixed(3)),
  }));
}

module.exports = {
  SYSTEM_PROMPT,
  PORTFOLIO_URL,
  MAX_HISTORY_MESSAGES,
  buildUserTurn,
  buildRetrievalQuery,
  toGeminiHistory,
  toPublicSources,
};
