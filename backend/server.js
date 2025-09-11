// backend/server.js
require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");
const chatRoutes = require("./routes/chatRoutes");
const cron = require("node-cron");

connectDB();
const app = express();
app.use(express.json());
app.use("/api", chatRoutes);

cron.schedule("0 0 * * *", async () => {
  console.log("Backing up data...");
  // Add actual backup logic here, e.g., using mongodump or exporting data
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
