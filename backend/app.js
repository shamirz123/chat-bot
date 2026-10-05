const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const { connectDB, isDBReady } = require("./config/db");
const chatRoutes = require("./routes/chat");
const documentRoutes = require("./routes/documents");
const healthRoutes = require("./routes/health");
const authRoutes = require("./routes/auth");

const DB_BACKED_PREFIXES = ["/api/auth", "/api/chat", "/api/documents"];

function isOriginAllowed(origin) {
  const allowed = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    process.env.FRONTEND_URL,
    ...(process.env.CORS_ORIGINS || "").split(",").map((s) => s.trim()),
  ].filter(Boolean);

  return !origin || allowed.includes(origin);
}

function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (isOriginAllowed(origin)) return callback(null, true);
        return callback(new Error(`CORS blocked for origin: ${origin}`));
      },
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );
  app.use(express.json({ limit: "100kb" }));

  // Ensure DB is ready before handlers that need MongoDB.
  app.use(async (req, res, next) => {
    if (!DB_BACKED_PREFIXES.some((p) => req.path.startsWith(p))) return next();
    try {
      await connectDB();
      next();
    } catch (err) {
      console.error("DB middleware error:", err.message);
      res.status(503).json({ error: "Database unavailable" });
    }
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/chat", chatRoutes);
  app.use("/api/documents", documentRoutes);
  app.use("/api/health", healthRoutes);

  app.get("/", (_req, res) => {
    res.json({
      message: "Backend is running. Use /api/* endpoints.",
      db: isDBReady() ? "connected" : "disconnected",
    });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.name === "MulterError") {
      const tooBig = err.code === "LIMIT_FILE_SIZE";
      return res.status(tooBig ? 413 : 400).json({
        error: tooBig
          ? "File is too large (max 5 MB)"
          : String(err.field || err.message),
      });
    }
    if (/^CORS blocked/.test(err.message)) {
      return res.status(403).json({ error: "Origin not allowed" });
    }
    if (err.type === "entity.parse.failed") {
      return res.status(400).json({ error: "Invalid JSON body" });
    }
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}

module.exports = { createApp, isOriginAllowed };
