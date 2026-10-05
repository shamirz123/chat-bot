const { stubDbReady, query } = require("./helpers");
const { test, mock, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { createApp } = require("../app");

stubDbReady();
const app = createApp();

beforeEach(() => mock.method(console, "error", () => {}));
afterEach(() => mock.restoreAll());

test("register rejects short passwords and malformed emails with 400", async () => {
  const short = await request(app).post("/api/auth/register").send({ email: "a@b.co", password: "short" });
  assert.equal(short.status, 400);
  assert.match(short.body.error, /at least 8/);

  const badEmail = await request(app).post("/api/auth/register").send({ email: "nope", password: "longenough1" });
  assert.equal(badEmail.status, 400);
  assert.match(badEmail.body.error, /email/i);
});

test("register stores a bcrypt hash and a normalised email, never the plain password", async () => {
  mock.method(User, "findOne", async () => null);
  const saved = mock.method(User.prototype, "save", async function () {
    return this;
  });

  const res = await request(app)
    .post("/api/auth/register")
    .send({ email: "  Person@Example.COM ", password: "correct horse" });

  assert.equal(res.status, 201);
  const doc = saved.mock.calls[0].this;
  assert.equal(doc.email, "person@example.com");
  assert.notEqual(doc.password, "correct horse");
  assert.ok(await bcrypt.compare("correct horse", doc.password));
});

test("register refuses a duplicate email", async () => {
  mock.method(User, "findOne", async () => ({ _id: "x" }));
  const res = await request(app).post("/api/auth/register").send({ email: "a@b.co", password: "longenough1" });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /already exists/);
});

test("login returns a verifiable JWT for valid credentials", async () => {
  const password = await bcrypt.hash("correct horse", 4);
  mock.method(User, "findOne", async () => ({ _id: "64b000000000000000000001", password }));

  const res = await request(app).post("/api/auth/login").send({ email: "a@b.co", password: "correct horse" });

  assert.equal(res.status, 200);
  const payload = jwt.verify(res.body.token, process.env.JWT_SECRET);
  assert.equal(payload.userId, "64b000000000000000000001");
});

test("login gives the same 401 for an unknown user and a wrong password", async () => {
  const password = await bcrypt.hash("right-password", 4);

  mock.method(User, "findOne", async () => null);
  const unknown = await request(app).post("/api/auth/login").send({ email: "a@b.co", password: "whatever1" });

  mock.method(User, "findOne", async () => ({ _id: "x", password }));
  const wrong = await request(app).post("/api/auth/login").send({ email: "a@b.co", password: "wrong-password" });

  assert.equal(unknown.status, 401);
  assert.equal(wrong.status, 401);
  assert.deepEqual(unknown.body, wrong.body);
});

test("login never writes the password to the logs", async () => {
  mock.method(User, "findOne", async () => null);
  const log = mock.method(console, "log", () => {});
  await request(app).post("/api/auth/login").send({ email: "a@b.co", password: "super-secret-pw" });
  const logged = JSON.stringify(log.mock.calls);
  assert.ok(!logged.includes("super-secret-pw"));
});

test("protected routes reject missing and invalid tokens", async () => {
  mock.method(User, "find", () => query([]));
  const none = await request(app).get("/api/chat/history");
  assert.equal(none.status, 401);
  const bad = await request(app).get("/api/chat/history").set("Authorization", "Bearer not.a.jwt");
  assert.equal(bad.status, 401);
});
