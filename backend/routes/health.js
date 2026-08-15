const express = require("express");
const router = express.Router();
const { MODEL_NAME } = require("../config/googleAI");
const { connectDB, isDBReady } = require("../config/db");

router.get("/", async (_req, res) => {
  let db = "disconnected";
  let dbError = null;

  try {
    await connectDB();
    db = isDBReady() ? "connected" : "disconnected";
  } catch (err) {
    dbError = err.message;
  }

  const ok = db === "connected";
  res.status(ok ? 200 : 503).json({
    ok,
    model: MODEL_NAME,
    db,
    ...(dbError ? { dbError } : {}),
    jwtSecret: process.env.JWT_SECRET ? "set" : "missing",
    mongoUri: process.env.MONGO_URI ? "set" : "missing",
  });
});

module.exports = router;
