const dns = require("dns");
const mongoose = require("mongoose");

let connectingPromise = null;

// Some Windows/ISP resolvers fail on mongodb+srv SRV lookups.
// Google DNS fixes local Atlas connects; skip on Vercel (platform DNS is fine).
if (!process.env.VERCEL) {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
}

async function connectDB() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error("MONGO_URI is not set");
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectingPromise) {
    return connectingPromise;
  }

  connectingPromise = mongoose
    .connect(uri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    })
    .then((conn) => {
      console.log("MongoDB Atlas connected:", conn.connection.name);
      return conn;
    })
    .catch((err) => {
      connectingPromise = null;
      console.error("MongoDB connection error:", err.message);
      throw err;
    });

  return connectingPromise;
}

function isDBReady() {
  return mongoose.connection.readyState === 1;
}

module.exports = { connectDB, isDBReady };
