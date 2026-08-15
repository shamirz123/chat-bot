const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const { connectDB, isDBReady } = require("./config/db");
const { loadCV } = require("./services/cvService");
const chatRoutes = require("./routes/chat");
const healthRoutes = require("./routes/health");
const authRoutes = require("./routes/auth");

const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Non-browser clients (curl/Postman) send no Origin.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      // Also allow Vercel / other deployed frontends via env list.
      const extra = (process.env.CORS_ORIGINS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (extra.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

// Ensure DB is ready before auth/chat handlers that need MongoDB.
app.use(async (req, res, next) => {
  if (!req.path.startsWith("/api/auth") && !req.path.startsWith("/api/chat")) {
    return next();
  }

  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("DB middleware error:", err.message);
    res.status(503).json({
      error: "Database unavailable",
      detail: err.message,
    });
  }
});

loadCV();

app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/health", healthRoutes);

app.get("/", (_req, res) => {
  res.json({
    message: "Backend is running. Use /api/* endpoints.",
    db: isDBReady() ? "connected" : "disconnected",
  });
});

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await connectDB();
  } catch (err) {
    console.error("Starting without MongoDB:", err.message);
  }

  // On Vercel, the platform invokes the exported app — do not listen.
  if (!process.env.VERCEL) {
    app.listen(PORT, () => {
      console.log(`Backend listening on port ${PORT}`);
    });
  }
}

start();

module.exports = app;
