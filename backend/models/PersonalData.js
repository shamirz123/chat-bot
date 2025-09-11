// backend/models/PersonalData.js
const mongoose = require("mongoose");

const personalSchema = new mongoose.Schema({
  category: String, // e.g., 'bio', 'preferences'
  content: String,
  vector: [Number], // For RAG embeddings
});

module.exports = mongoose.model("PersonalData", personalSchema);
