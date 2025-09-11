// backend/routes/chatRoutes.js
const express = require("express");
const { chat, addPersonalData } = require("../controllers/chatController");

const router = express.Router();

router.post("/chat", chat);
router.post("/add-data", addPersonalData); // Endpoint to add personal data

module.exports = router;
