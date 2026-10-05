const rateLimit = require("express-rate-limit");

const json429 = (message) => (_req, res) => res.status(429).json({ error: message });

// Brute-force protection for login/register (per IP).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: json429("Too many attempts. Please try again later."),
});

// Gemini calls cost money: limit per authenticated user (runs after auth).
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user.userId),
  handler: json429("You're sending messages too quickly. Slow down a little."),
});

// Uploads trigger embedding work: tighter per-user cap.
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 15,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user.userId),
  handler: json429("Upload limit reached. Try again in an hour."),
});

module.exports = { authLimiter, chatLimiter, uploadLimiter };
