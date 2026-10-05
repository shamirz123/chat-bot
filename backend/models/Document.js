const mongoose = require("mongoose");

// A source document that has been (or is being) chunked and embedded.
// userId === null marks a shared document (the CV) visible to every user.
const documentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  name: { type: String, required: true },
  kind: { type: String, enum: ["cv", "upload"], default: "upload" },
  status: { type: String, enum: ["indexing", "ready"], default: "ready" },
  contentHash: { type: String },
  chunkCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

// Only one shared CV document may exist, which makes first-indexing race-safe
// across serverless instances (the loser gets a duplicate-key error).
documentSchema.index(
  { kind: 1 },
  { unique: true, partialFilterExpression: { kind: "cv" } }
);

module.exports = mongoose.model("Document", documentSchema);
