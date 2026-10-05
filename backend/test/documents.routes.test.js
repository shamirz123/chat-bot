const { stubDbReady, query, tokenFor, USER_ID } = require("./helpers");
const { test, mock, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { ai } = require("../config/googleAI");
const Chunk = require("../models/Chunk");
const Document = require("../models/Document");
const { createApp } = require("../app");

stubDbReady();
const app = createApp();
const auth = { Authorization: `Bearer ${tokenFor()}` };

let inserted;

function setup({ existingDocs = 0 } = {}) {
  inserted = [];
  mock.method(ai.models, "embedContent", async ({ contents }) => ({
    embeddings: contents.map((_, i) => ({ values: [i + 1, 0] })),
  }));
  mock.method(Document, "countDocuments", async () => existingDocs);
  mock.method(Document, "create", async (d) => ({ _id: "507f1f77bcf86cd799439011", createdAt: new Date(), ...d }));
  mock.method(Chunk, "insertMany", async (docs) => {
    inserted.push(...docs);
    return docs;
  });
}

beforeEach(() => mock.method(console, "error", () => {}));
afterEach(() => mock.restoreAll());

const upload = (name, content, type = "text/plain") =>
  request(app).post("/api/documents").set(auth).attach("file", Buffer.from(content), { filename: name, contentType: type });

test("uploading a text file chunks, embeds and stores it for the user", async () => {
  setup();
  const res = await upload("notes.md", "# Notes\n\nShahmir likes TypeScript.\n\nHe also likes testing.");

  assert.equal(res.status, 201);
  assert.equal(res.body.name, "notes.md");
  assert.equal(res.body.kind, "upload");
  assert.ok(res.body.chunkCount >= 1);

  assert.equal(inserted.length, res.body.chunkCount);
  assert.equal(String(inserted[0].userId), USER_ID);
  assert.equal(inserted[0].docName, "notes.md");
  assert.deepEqual(inserted[0].embedding, [1, 0]);
});

test("rejects unsupported file types", async () => {
  setup();
  const res = await upload("malware.exe", "MZ...", "application/octet-stream");
  assert.equal(res.status, 400);
  assert.match(res.body.error, /PDF, TXT and MD/);
  assert.equal(inserted.length, 0);
});

test("rejects files over 5 MB with 413", async () => {
  setup();
  const res = await upload("big.txt", "a".repeat(5 * 1024 * 1024 + 10));
  assert.equal(res.status, 413);
});

test("rejects empty documents with 422", async () => {
  setup();
  const res = await upload("empty.txt", "   \n  ");
  assert.equal(res.status, 422);
  assert.match(res.body.error, /no readable text/);
});

test("rejects a corrupt PDF with 422", async () => {
  setup();
  const res = await upload("broken.pdf", "this is not a pdf", "application/pdf");
  assert.equal(res.status, 422);
});

test("enforces the per-user document cap", async () => {
  setup({ existingDocs: 10 });
  const res = await upload("one-more.txt", "hello");
  assert.equal(res.status, 409);
  assert.equal(inserted.length, 0);
});

test("requires auth and a file", async () => {
  setup();
  const anon = await request(app).post("/api/documents").attach("file", Buffer.from("x"), "a.txt");
  assert.equal(anon.status, 401);

  const noFile = await request(app).post("/api/documents").set(auth);
  assert.equal(noFile.status, 400);
});

test("lists shared and own documents, indexing the shared CV on first use", async () => {
  setup();
  mock.method(console, "log", () => {});
  mock.method(Document, "findOne", async () => null); // CV not indexed yet
  mock.method(Document, "updateOne", async () => ({}));
  mock.method(Document, "find", () =>
    query([{ _id: "1", name: "CV", kind: "cv", chunkCount: 5, createdAt: new Date() }])
  );
  const res = await request(app).get("/api/documents").set(auth);
  assert.equal(res.status, 200);
  assert.equal(res.body[0].id, "1");
  assert.equal(res.body[0].kind, "cv");

  const created = Document.create.mock.calls.map((c) => c.arguments[0]);
  assert.equal(created.length, 1);
  assert.equal(created[0].kind, "cv");
  assert.equal(created[0].userId, null);
  assert.equal(created[0].status, "indexing");
  assert.ok(inserted.length > 0, "CV chunks should be embedded and stored");
});

test("delete validates the id and only removes the caller's own uploads", async () => {
  setup();
  const bad = await request(app).delete("/api/documents/not-an-id").set(auth);
  assert.equal(bad.status, 400);

  const filter = [];
  mock.method(Document, "findOne", async (f) => {
    filter.push(f);
    return null; // not found / not owned
  });
  const missing = await request(app).delete("/api/documents/507f1f77bcf86cd799439011").set(auth);
  assert.equal(missing.status, 404);
  assert.equal(filter[0].kind, "upload", "shared CV must never be deletable");
  assert.equal(String(filter[0].userId), USER_ID);

  const deleted = [];
  mock.method(Document, "findOne", async () => ({ _id: "507f1f77bcf86cd799439011" }));
  mock.method(Chunk, "deleteMany", async (f) => deleted.push(["chunks", f]));
  mock.method(Document, "deleteOne", async (f) => deleted.push(["doc", f]));
  const ok = await request(app).delete("/api/documents/507f1f77bcf86cd799439011").set(auth);
  assert.equal(ok.status, 204);
  assert.deepEqual(deleted.map((d) => d[0]), ["chunks", "doc"]);
});
