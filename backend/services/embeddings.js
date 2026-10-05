const { ai } = require("../config/googleAI");
const { withRetry } = require("./llm");

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;
const BATCH_SIZE = 50; // the API accepts up to 100 inputs per request

async function embedTexts(texts, taskType = "RETRIEVAL_DOCUMENT") {
  const vectors = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await withRetry(() =>
      ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: batch,
        config: { taskType, outputDimensionality: EMBEDDING_DIMENSIONS },
      }),
    );
    const embeddings = response.embeddings || [];
    if (embeddings.length !== batch.length) {
      throw new Error(
        `Embedding count mismatch: expected ${batch.length}, got ${embeddings.length}`,
      );
    }
    for (const e of embeddings) vectors.push(e.values);
  }
  return vectors;
}

module.exports = { embedTexts, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS };
