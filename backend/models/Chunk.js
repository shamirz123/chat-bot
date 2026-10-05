const mongoose = require("mongoose");

const chunkSchema = new mongoose.Schema({
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: "Document", required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  docName: { type: String, required: true },
  index: { type: Number, required: true },
  text: { type: String, required: true },
  embedding: { type: [Number], required: true },
});

module.exports = mongoose.model("Chunk", chunkSchema);
