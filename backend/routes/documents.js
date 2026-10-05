const express = require("express");
const multer = require("multer");
const path = require("path");
const mongoose = require("mongoose");
const pdfParse = require("pdf-parse");
const auth = require("../middleware/auth");
const { uploadLimiter } = require("../middleware/rateLimit");
const Document = require("../models/Document");
const rag = require("../services/ragService");

const router = express.Router();

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_DOCS_PER_USER = 10;
const MAX_TEXT_CHARS = 200_000;
const ALLOWED_EXT = new Set([".pdf", ".txt", ".md"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "Only PDF, TXT and MD files are supported"));
    }
    cb(null, true);
  },
});

async function extractText(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  const text =
    ext === ".pdf" ? (await pdfParse(file.buffer)).text : file.buffer.toString("utf8");
  return text.slice(0, MAX_TEXT_CHARS);
}

const toDto = (d) => ({
  id: d._id.toString(),
  name: d.name,
  kind: d.kind,
  chunkCount: d.chunkCount,
  createdAt: d.createdAt,
});

router.get("/", auth, async (req, res) => {
  try {
    // Index the shared CV on first use so it shows up in the list immediately.
    await rag.ensureCVIndexed().catch((err) =>
      console.warn("CV indexing failed:", err.message)
    );
    const docs = await rag.listDocuments(req.user.userId);
    res.json(docs.map(toDto));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list documents" });
  }
});

router.post("/", auth, uploadLimiter, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "A file is required" });

    const count = await Document.countDocuments({ userId: req.user.userId, kind: "upload" });
    if (count >= MAX_DOCS_PER_USER) {
      return res
        .status(409)
        .json({ error: `You can keep up to ${MAX_DOCS_PER_USER} documents. Delete one first.` });
    }

    let text;
    try {
      text = await extractText(req.file);
    } catch {
      return res.status(422).json({ error: "Could not read that file" });
    }

    const name = path.basename(req.file.originalname).slice(0, 120);
    const doc = await rag.indexUpload({ userId: req.user.userId, name, text });
    res.status(201).json(toDto(doc));
  } catch (err) {
    if (/no readable text|too large/.test(err.message)) {
      return res.status(422).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to index document" });
  }
});

router.delete("/:id", auth, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: "Invalid document id" });
  }
  try {
    const removed = await rag.deleteUserDocument(req.user.userId, req.params.id);
    if (!removed) return res.status(404).json({ error: "Document not found" });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete document" });
  }
});

module.exports = router;
