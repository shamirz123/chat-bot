const express = require("express");
const router = express.Router();
const { MODEL_NAME } = require("../config/googleAI");

router.get("/", (_req, res) => {
  res.json({ ok: true, model: MODEL_NAME });
});

module.exports = router;
