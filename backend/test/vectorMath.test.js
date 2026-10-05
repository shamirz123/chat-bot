require("./helpers");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { cosineSimilarity, topK } = require("../services/vectorMath");

test("cosine similarity of identical, orthogonal and opposite vectors", () => {
  assert.ok(Math.abs(cosineSimilarity([1, 2, 3], [1, 2, 3]) - 1) < 1e-9);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.ok(Math.abs(cosineSimilarity([1, 0], [-1, 0]) + 1) < 1e-9);
});

test("is scale-invariant", () => {
  assert.ok(Math.abs(cosineSimilarity([1, 1], [5, 5]) - 1) < 1e-9);
});

test("returns 0 for zero, empty or mismatched vectors instead of NaN", () => {
  assert.equal(cosineSimilarity([0, 0], [1, 1]), 0);
  assert.equal(cosineSimilarity([], []), 0);
  assert.equal(cosineSimilarity([1, 2], [1]), 0);
  assert.equal(cosineSimilarity(undefined, [1]), 0);
});

test("topK ranks best first, applies minScore and limits to k", () => {
  const items = [
    { id: "far", embedding: [0, 1] },
    { id: "near", embedding: [1, 0.1] },
    { id: "exact", embedding: [1, 0] },
    { id: "mid", embedding: [1, 1] },
  ];
  const all = topK([1, 0], items, { k: 10, minScore: 0 }).map((r) => r.item.id);
  assert.deepEqual(all, ["exact", "near", "mid", "far"]);

  const filtered = topK([1, 0], items, { k: 10, minScore: 0.9 }).map((r) => r.item.id);
  assert.deepEqual(filtered, ["exact", "near"]);

  assert.equal(topK([1, 0], items, { k: 1 }).length, 1);
});
