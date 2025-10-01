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

// CORS configuration for production
const allowedOrigins = [
  "https://shahmir-bot.vercel.app",
  "http://localhost:3000", // for local development
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

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

// Root route
app.get("/", (_req, res) => {
  res.json({ message: "Backend is running. Use /api/* endpoints." });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});

module.exports = app; // Export for Vercel
