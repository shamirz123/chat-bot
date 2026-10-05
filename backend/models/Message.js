const mongoose = require("mongoose");

const sourceSchema = new mongoose.Schema(
  {
    n: Number,
    docName: String,
    excerpt: String,
    score: Number,
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  role: { type: String, required: true },
  content: { type: String, required: true },
  sources: { type: [sourceSchema], default: undefined },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Message", messageSchema);
