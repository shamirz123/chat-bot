const express = require("express");
const router = express.Router();

// Dynamic imports to handle missing dependencies
let bcrypt, jwt, User;

try {
  bcrypt = require("bcryptjs");
  jwt = require("jsonwebtoken");
  User = require("../models/User");
} catch (err) {
  console.error("Failed to load dependencies:", err.message);
}

// Simple test route
router.get("/test", (req, res) => {
  res.json({
    message: "Auth route is working!",
    bcryptAvailable: !!bcrypt,
    jwtAvailable: !!jwt,
    userModelAvailable: !!User,
    jwtSecretSet: !!process.env.JWT_SECRET,
  });
});

// Register route with comprehensive error handling
router.post("/register", async (req, res) => {
  console.log("=== REGISTER REQUEST START ===");

  try {
    // Check dependencies
    if (!bcrypt) {
      console.error("bcryptjs not available");
      return res.status(500).json({ error: "bcryptjs module not found" });
    }

    if (!jwt) {
      console.error("jsonwebtoken not available");
      return res.status(500).json({ error: "jsonwebtoken module not found" });
    }

    if (!User) {
      console.error("User model not available");
      return res.status(500).json({ error: "User model not found" });
    }

    console.log("Body received:", req.body);
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      console.log("Missing email or password");
      return res.status(400).json({
        error: "Email and password required",
        received: { email: !!email, password: !!password },
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Password length
    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    // Check JWT_SECRET
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not set!");
      return res
        .status(500)
        .json({ error: "Server configuration error: JWT_SECRET missing" });
    }

    // Check for existing user
    console.log("Checking existing user...");
    let existingUser;
    try {
      existingUser = await User.findOne({ email });
    } catch (dbErr) {
      console.error("Database error checking user:", dbErr.message);
      return res.status(500).json({
        error: "Database error",
        message: dbErr.message,
      });
    }

    if (existingUser) {
      console.log("User already exists");
      return res.status(400).json({ error: "User already exists" });
    }

    // Hash password
    console.log("Hashing password...");
    let hashedPassword;
    try {
      hashedPassword = await bcrypt.hash(password, 10);
    } catch (hashErr) {
      console.error("Hashing error:", hashErr.message);
      return res.status(500).json({
        error: "Password hashing failed",
        message: hashErr.message,
      });
    }

    // Create and save user
    console.log("Creating user...");
    try {
      const user = new User({ email, password: hashedPassword });
      await user.save();
      console.log("User created successfully:", email);

      return res.status(201).json({
        message: "User registered successfully",
        email: email,
      });
    } catch (saveErr) {
      console.error("Save error:", saveErr.message);
      return res.status(500).json({
        error: "Failed to save user",
        message: saveErr.message,
      });
    }
  } catch (err) {
    console.error("UNEXPECTED ERROR:", err);
    return res.status(500).json({
      error: "Registration failed",
      message: err.message,
      stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
    });
  }
});

// Login route
router.post("/login", async (req, res) => {
  console.log("=== LOGIN REQUEST START ===");

  try {
    if (!bcrypt || !jwt || !User) {
      return res.status(500).json({ error: "Required modules not available" });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    console.log("Finding user:", email);
    let user;
    try {
      user = await User.findOne({ email });
    } catch (dbErr) {
      console.error("Database error:", dbErr.message);
      return res.status(500).json({
        error: "Database error",
        message: dbErr.message,
      });
    }

    if (!user) {
      console.log("User not found");
      return res.status(401).json({ error: "Invalid credentials" });
    }

    console.log("Comparing passwords...");
    let isMatch;
    try {
      isMatch = await bcrypt.compare(password, user.password);
    } catch (compareErr) {
      console.error("Password comparison error:", compareErr.message);
      return res.status(500).json({
        error: "Password verification failed",
        message: compareErr.message,
      });
    }

    if (!isMatch) {
      console.log("Password mismatch");
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET not set");
      return res.status(500).json({ error: "Server configuration error" });
    }

    console.log("Generating token...");
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "24h",
    });

    console.log("Login successful");
    return res.json({
      token,
      email: user.email,
    });
  } catch (err) {
    console.error("UNEXPECTED ERROR:", err);
    return res.status(500).json({
      error: "Login failed",
      message: err.message,
      stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
    });
  }
});

module.exports = router;
