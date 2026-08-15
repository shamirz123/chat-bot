const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password required" });

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ error: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword });
    await user.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({
      error: "Registration failed",
      detail: err.message,
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    console.log("Login request received:", req.body);
    const { email, password } = req.body;
    if (!email || !password) {
      console.log("Missing email or password");
      return res.status(400).json({ error: "Email and password required" });
    }

    console.log("Searching for user with email:", email);
    const user = await User.findOne({ email });
    if (!user) {
      console.log("User not found");
      return res.status(401).json({ error: "Invalid credentials" });
    }

    console.log("Comparing passwords");
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("Password mismatch");
      return res.status(401).json({ error: "Invalid credentials" });
    }

    console.log(
      "Generating JWT with secret:",
      process.env.JWT_SECRET ? "Set" : "Not set"
    );
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    console.log("Login successful, token generated");
    res.json({ token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({
      error: "Login failed",
      detail: err.message,
    });
  }
});

module.exports = router;
