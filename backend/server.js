const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config();

const { loadCV } = require("./services/cvService");
const chatRoutes = require("./routes/chat");
const healthRoutes = require("./routes/health");
const authRoutes = require("./routes/auth");

const app = express();

// Enable CORS for Vercel frontend
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

// MongoDB connection
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Load CV at server start
loadCV();

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/health", healthRoutes);

// Optional root route
app.get("/", (_req, res) => {
  res.json({ message: "Backend is running. Use /api/* endpoints." });
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
