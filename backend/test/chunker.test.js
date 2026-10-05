require("./helpers");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { chunkText } = require("../services/chunker");

test("returns no chunks for empty or whitespace input", () => {
  assert.deepEqual(chunkText(""), []);
  assert.deepEqual(chunkText("  \n\n  "), []);
});

test("keeps short text as a single chunk", () => {
  const chunks = chunkText("Hello world.\n\nSecond paragraph.");
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].index, 0);
  assert.match(chunks[0].text, /Hello world\.\n\nSecond paragraph\./);
});

test("never exceeds the size limit and indexes chunks sequentially", () => {
  const paragraph = "This is a sentence about React and TypeScript. ".repeat(12).trim();
  const text = Array.from({ length: 10 }, () => paragraph).join("\n\n");
  const chunks = chunkText(text, { size: 500, overlap: 80 });
  assert.ok(chunks.length > 1);
  chunks.forEach((c, i) => {
    assert.equal(c.index, i);
    assert.ok(c.text.length <= 500, `chunk ${i} is ${c.text.length} chars`);
  });
});

test("consecutive chunks overlap so context isn't cut mid-thought", () => {
  const text = Array.from({ length: 8 }, (_, i) => `Paragraph ${i} ` + "word ".repeat(40)).join("\n\n");
  const chunks = chunkText(text, { size: 400, overlap: 100 });
  assert.ok(chunks.length > 1);
  for (let i = 1; i < chunks.length; i++) {
    const tailWord = chunks[i - 1].text.split(/\s+/).slice(-3).join(" ");
    assert.ok(chunks[i].text.includes(tailWord), `chunk ${i} should repeat the end of chunk ${i - 1}`);
  }
});

test("hard-splits text that has no punctuation or newlines", () => {
  const chunks = chunkText("x".repeat(2500), { size: 1000, overlap: 100 });
  assert.equal(chunks.length, 3);
  assert.ok(chunks.every((c) => c.text.length <= 1000));
});

test("rejects an overlap that is not smaller than the size", () => {
  assert.throws(() => chunkText("text", { size: 100, overlap: 100 }), /overlap/);
});
