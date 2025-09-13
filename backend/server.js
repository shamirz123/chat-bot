const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const { loadCV } = require("./services/cvService");
const chatRoutes = require("./routes/chat");
const healthRoutes = require("./routes/health");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Load CV at server start
loadCV();

// Routes
app.use("/api/chat", chatRoutes);
app.use("/api/health", healthRoutes);

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
