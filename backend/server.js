require("dotenv").config();

const { createApp } = require("./app");
const { connectDB } = require("./config/db");

const app = createApp();
const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await connectDB();
  } catch (err) {
    console.error("Starting without MongoDB:", err.message);
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, () => {
      console.log(`Backend listening on port ${PORT}`);
    });
  }
}

start();

module.exports = app;
