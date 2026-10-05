// Shared test setup. Required first by every test file so env is set before
// any app module reads it. Only external boundaries (Gemini, MongoDB) are faked.
process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "test-key";
process.env.JWT_SECRET = "test-secret";
process.env.MONGO_URI = "mongodb://localhost/test"; // never connected; see stubDbReady

const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

/** A thenable query stub supporting the chain methods the code uses. */
function query(result) {
  const q = {
    sort: () => q,
    limit: () => q,
    select: () => q,
    lean: () => q,
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return q;
}

/** Makes connectDB() short-circuit as if Mongo were connected. */
function stubDbReady() {
  Object.defineProperty(mongoose.connection, "readyState", {
    get: () => 1,
    configurable: true,
  });
}

const USER_ID = "64b000000000000000000001";
const tokenFor = (userId = USER_ID) => jwt.sign({ userId }, process.env.JWT_SECRET);

/** supertest .parse() handler that returns an SSE body as an array of payloads. */
function parseSSE(res, cb) {
  let raw = "";
  res.on("data", (c) => (raw += c));
  res.on("end", () =>
    cb(
      null,
      raw
        .split("\n\n")
        .filter((e) => e.startsWith("data:"))
        .map((e) => JSON.parse(e.slice(5)))
    )
  );
}

/** Async generator standing in for Gemini's streaming response. */
async function* fakeStream(...texts) {
  for (const text of texts) yield { text };
}

module.exports = { query, stubDbReady, tokenFor, parseSSE, fakeStream, USER_ID };
