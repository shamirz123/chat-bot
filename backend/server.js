const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config();

const app = express();

// CORS - Allow all origins for testing (you can restrict later)
app.use(
  cors({
    origin: "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

console.log("=== SERVER STARTING ===");
console.log("Environment check:");
console.log("- MONGO_URI:", process.env.MONGO_URI ? "SET" : "NOT SET");
console.log("- JWT_SECRET:", process.env.JWT_SECRET ? "SET" : "NOT SET");
console.log(
  "- GOOGLE_API_KEY:",
  process.env.GOOGLE_API_KEY ? "SET" : "NOT SET"
);

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI;

if (MONGO_URI) {
  mongoose
    .connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    })
    .then(() => {
      console.log("✅ MongoDB connected successfully");
    })
    .catch((err) => {
      console.error("❌ MongoDB connection error:", err.message);
    });
} else {
  console.error("❌ MONGO_URI not set in environment variables");
}

// Load CV service (optional, won't break if fails)
try {
  const { loadCV } = require("./services/cvService");
  loadCV().catch((err) => console.warn("CV loading skipped:", err.message));
} catch (err) {
  console.warn("CV service not available:", err.message);
}

// Health check route
app.get("/", (req, res) => {
  res.json({
    status: "running",
    message: "Backend is running. Use /api/* endpoints.",
    mongoConnected: mongoose.connection.readyState === 1,
    timestamp: new Date().toISOString(),
    env: {
      mongoUri: !!process.env.MONGO_URI,
      jwtSecret: !!process.env.JWT_SECRET,
      googleApiKey: !!process.env.GOOGLE_API_KEY,
    },
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    mongoConnected: mongoose.connection.readyState === 1,
    timestamp: new Date().toISOString(),
  });
});

// Import and use routes
try {
  const authRoutes = require("./routes/auth");
  const chatRoutes = require("./routes/chat");
  const healthRoutes = require("./routes/health");

  app.use("/api/auth", authRoutes);
  app.use("/api/chat", chatRoutes);
  app.use("/api/health", healthRoutes);

  console.log("✅ Routes loaded successfully");
} catch (err) {
  console.error("❌ Error loading routes:", err.message);
}

// 404 handler
app.use((req, res) => {
  console.log("404:", req.method, req.path);
  res.status(404).json({
    error: "Route not found",
    path: req.path,
    method: req.method,
    availableRoutes: [
      "GET /",
      "GET /api/health",
      "GET /api/auth/test",
      "POST /api/auth/register",
      "POST /api/auth/login",
    ],
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("=== ERROR ===");
  console.error("Message:", err.message);
  console.error("Stack:", err.stack);

  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
    path: req.path,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
});

// Local development
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
