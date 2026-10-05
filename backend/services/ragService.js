const crypto = require("crypto");
const Document = require("../models/Document");
const Chunk = require("../models/Chunk");
const { chunkText } = require("./chunker");
const { embedTexts } = require("./embeddings");
const { topK } = require("./vectorMath");
const { loadCV, CV_NAME } = require("./cvService");

const MAX_CHUNKS_PER_DOC = 200;
const STALE_INDEXING_MS = 2 * 60 * 1000;
const TOP_K = Number(process.env.RAG_TOP_K) || 5;
const MIN_SCORE = Number(process.env.RAG_MIN_SCORE) || 0.55;

const hash = (text) => crypto.createHash("sha256").update(text).digest("hex");

async function removeDocument(docId) {
  await Chunk.deleteMany({ documentId: docId });
  await Document.deleteOne({ _id: docId });
}

async function storeChunks(doc, chunks, vectors) {
  await Chunk.insertMany(
    chunks.map((c, i) => ({
      documentId: doc._id,
      userId: doc.userId,
      docName: doc.name,
      index: c.index,
      text: c.text,
      embedding: vectors[i],
    })),
  );
}

/** Chunks, embeds and stores a user-uploaded document. */
async function indexUpload({ userId, name, text }) {
  const chunks = chunkText(text);
  if (!chunks.length) throw new Error("Document contains no readable text");
  if (chunks.length > MAX_CHUNKS_PER_DOC) {
    throw new Error(
      `Document is too large (${chunks.length} chunks, max ${MAX_CHUNKS_PER_DOC})`,
    );
  }

  const vectors = await embedTexts(
    chunks.map((c) => c.text),
    "RETRIEVAL_DOCUMENT",
  );

  const doc = await Document.create({
    userId,
    name,
    kind: "upload",
    contentHash: hash(text),
    chunkCount: chunks.length,
  });
  try {
    await storeChunks(doc, chunks, vectors);
  } catch (err) {
    await removeDocument(doc._id);
    throw err;
  }
  return doc;
}

let cvReady = null; // memoised per process

async function indexCV() {
  const text = await loadCV();
  if (!text.trim()) return;
  const contentHash = hash(text);

  const existing = await Document.findOne({ kind: "cv" });
  if (existing) {
    const current =
      existing.status === "ready" && existing.contentHash === contentHash;
    const inFlight =
      existing.status === "indexing" &&
      Date.now() - existing.createdAt.getTime() < STALE_INDEXING_MS;
    if (current || inFlight) return;
    await removeDocument(existing._id); // CV changed, or an earlier run died mid-way
  }

  const chunks = chunkText(text);
  let doc;
  try {
    // Creating the document first acts as a lock (unique index on kind: "cv").
    doc = await Document.create({
      userId: null,
      name: CV_NAME,
      kind: "cv",
      status: "indexing",
      contentHash,
      chunkCount: chunks.length,
    });
  } catch (err) {
    if (err.code === 11000) return; // another instance is indexing it
    throw err;
  }

  try {
    const vectors = await embedTexts(
      chunks.map((c) => c.text),
      "RETRIEVAL_DOCUMENT",
    );
    await storeChunks(doc, chunks, vectors);
    await Document.updateOne({ _id: doc._id }, { status: "ready" });
    console.log(`CV indexed: ${chunks.length} chunks`);
  } catch (err) {
    await removeDocument(doc._id);
    throw err;
  }
}

/** Makes sure the CV is embedded and stored; safe to call on every request. */
function ensureCVIndexed() {
  if (!cvReady) {
    cvReady = indexCV().catch((err) => {
      cvReady = null; // retry on the next request
      throw err;
    });
  }
  return cvReady;
}

/** Returns the most relevant chunks (shared CV + this user's uploads) for a query. */
async function retrieve(
  userId,
  query,
  { k = TOP_K, minScore = MIN_SCORE } = {},
) {
  const [queryVec] = await embedTexts([query], "RETRIEVAL_QUERY");
  const candidates = await Chunk.find({ userId: { $in: [null, userId] } })
    .select("docName text embedding")
    .lean();

  return topK(queryVec, candidates, { k, minScore }).map(({ item, score }) => ({
    docName: item.docName,
    text: item.text,
    score,
  }));
}

async function listDocuments(userId) {
  return Document.find({ $or: [{ userId: null, status: "ready" }, { userId }] })
    .sort({ kind: 1, createdAt: -1 })
    .lean();
}

async function deleteUserDocument(userId, docId) {
  const doc = await Document.findOne({ _id: docId, userId, kind: "upload" });
  if (!doc) return false;
  await removeDocument(doc._id);
  return true;
}

module.exports = {
  indexUpload,
  ensureCVIndexed,
  retrieve,
  listDocuments,
  deleteUserDocument,
  MAX_CHUNKS_PER_DOC,
};
