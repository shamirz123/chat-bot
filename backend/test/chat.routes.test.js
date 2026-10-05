const { stubDbReady, query, tokenFor, parseSSE, fakeStream, USER_ID } = require("./helpers");
const { test, mock, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { ai } = require("../config/googleAI");
const Message = require("../models/Message");
const Chunk = require("../models/Chunk");
const Document = require("../models/Document");
const { createApp } = require("../app");

stubDbReady();
const app = createApp();
const auth = { Authorization: `Bearer ${tokenFor()}` };

const CV_CHUNK = { docName: "Shahmir's CV", text: "Shahmir worked at LALA Group as a React developer.", embedding: [1, 0] };
const UNRELATED = { docName: "Shahmir's CV", text: "Education: BSCS.", embedding: [0, 1] };

let saved;
let sentToModel;

/** Fakes the external boundaries: Gemini (embed + chat) and MongoDB. */
function setup({ chunks = [CV_CHUNK, UNRELATED], history = [], reply = ["Hello ", "world [1]"] } = {}) {
  saved = [];
  sentToModel = null;

  // Query vector [1, 0]: identical to CV_CHUNK (score 1), orthogonal to UNRELATED (score 0).
  mock.method(ai.models, "embedContent", async ({ contents }) => ({
    embeddings: contents.map(() => ({ values: [1, 0] })),
  }));
  mock.method(ai.chats, "create", ({ history: h }) => ({
    sendMessageStream: async ({ message }) => {
      sentToModel = { history: h, message };
      return fakeStream(...reply);
    },
  }));

  mock.method(Document, "findOne", async () => null);
  mock.method(Document, "create", async (d) => ({ _id: "doc1", ...d }));
  mock.method(Document, "updateOne", async () => ({}));
  mock.method(Chunk, "insertMany", async () => []);
  mock.method(Chunk, "find", () => query(chunks));
  // The route sorts newest-first with a limit, then reverses; emulate that order.
  mock.method(Message, "find", () => query([...history].reverse()));
  mock.method(Message, "insertMany", async (docs) => {
    saved.push(...docs);
    return docs;
  });
}

beforeEach(() => {
  mock.method(console, "log", () => {});
  mock.method(console, "warn", () => {});
  mock.method(console, "error", () => {});
});
afterEach(() => mock.restoreAll());

const stream = (message) =>
  request(app).post("/api/chat/stream").set(auth).send({ message }).buffer(true).parse(parseSSE);

test("streams sources first, then deltas, then done", async () => {
  setup();
  const res = await stream("Where did Shahmir work?");

  assert.equal(res.status, 200);
  assert.match(res.headers["content-type"], /text\/event-stream/);
  const events = res.body;
  assert.equal(events[0].sources.length, 1);
  assert.equal(events[0].sources[0].n, 1);
  assert.equal(events[0].sources[0].docName, "Shahmir's CV");
  assert.deepEqual(
    events.slice(1).map((e) => e.delta ?? (e.done ? "DONE" : "?")),
    ["Hello ", "world [1]", "DONE"]
  );
});

test("grounds the model prompt in only the relevant chunks, with numbered citations", async () => {
  setup();
  await stream("Where did Shahmir work?");

  assert.match(sentToModel.message, /\[1\] \(Shahmir's CV\)\nShahmir worked at LALA/);
  assert.ok(!sentToModel.message.includes("Education: BSCS"), "below-threshold chunk must be excluded");
  assert.match(sentToModel.message, /Question: Where did Shahmir work\?/);
});

test("persists the exchange with its sources, user turn first", async () => {
  setup();
  await stream("Where did Shahmir work?");

  assert.equal(saved.length, 2);
  assert.equal(saved[0].role, "user");
  assert.equal(saved[0].content, "Where did Shahmir work?");
  assert.equal(saved[1].role, "shamirbot");
  assert.equal(saved[1].content, "Hello world [1]");
  assert.equal(saved[1].sources[0].n, 1);
  assert.ok(saved[1].timestamp > saved[0].timestamp);
  assert.equal(String(saved[0].userId), USER_ID);
});

test("sends no sources event and a plain prompt when nothing is relevant", async () => {
  setup({ chunks: [UNRELATED] });
  const res = await stream("Write a poem about the sea");

  assert.ok(res.body.every((e) => !e.sources));
  assert.equal(sentToModel.message, "Write a poem about the sea");
  assert.equal(saved[1].sources, undefined);
});

test("still answers when retrieval fails (embedding API down)", async () => {
  setup();
  mock.method(ai.models, "embedContent", async () => {
    throw new Error("embedding service down");
  });
  const res = await stream("Hi there");

  assert.equal(res.status, 200);
  assert.ok(res.body.some((e) => e.delta));
  assert.ok(res.body.some((e) => e.done));
  assert.equal(sentToModel.message, "Hi there");
});

test("passes recent history to the model and enriches a short follow-up query", async () => {
  const history = [
    { role: "user", content: "Where did Shahmir work?" },
    { role: "shamirbot", content: "At LALA." },
  ];
  setup({ history });
  const embedCalls = [];
  mock.method(ai.models, "embedContent", async ({ contents, config }) => {
    embedCalls.push({ contents, taskType: config.taskType });
    return { embeddings: contents.map(() => ({ values: [1, 0] })) };
  });

  await stream("and before that?");

  assert.deepEqual(sentToModel.history.map((h) => h.role), ["user", "model"]);
  const queryCall = embedCalls.find((c) => c.taskType === "RETRIEVAL_QUERY");
  assert.equal(queryCall.contents[0], "Where did Shahmir work?\nand before that?");
});

test("reports a friendly error event when the model is overloaded", async () => {
  setup();
  mock.method(ai.chats, "create", () => ({
    sendMessageStream: async () => {
      throw Object.assign(new Error("overloaded"), { status: 503 });
    },
  }));
  const res = await stream("hello");

  assert.equal(res.status, 200);
  assert.match(res.body.at(-1).error, /busy/i);
  assert.equal(saved.length, 0, "failed turns must not be persisted");
});

test("validates input and requires auth", async () => {
  setup();
  const empty = await request(app).post("/api/chat/stream").set(auth).send({ message: "   " });
  assert.equal(empty.status, 400);

  const tooLong = await request(app).post("/api/chat/stream").set(auth).send({ message: "x".repeat(4001) });
  assert.equal(tooLong.status, 400);

  const anon = await request(app).post("/api/chat/stream").send({ message: "hi" });
  assert.equal(anon.status, 401);
});

test("history includes stored sources", async () => {
  setup();
  mock.method(Message, "find", () =>
    query([
      { _id: "a", role: "user", content: "q" },
      { _id: "b", role: "shamirbot", content: "a", sources: [{ n: 1, docName: "CV", excerpt: "e", score: 0.7 }] },
    ])
  );
  const res = await request(app).get("/api/chat/history").set(auth);

  assert.equal(res.status, 200);
  assert.equal(res.body[0].sources, undefined);
  assert.equal(res.body[1].sources[0].docName, "CV");
});
