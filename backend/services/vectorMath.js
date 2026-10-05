function dot(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

function norm(v) {
  return Math.sqrt(dot(v, v));
}

function cosineSimilarity(a, b) {
  if (!a?.length || a.length !== b?.length) return 0;
  const denom = norm(a) * norm(b);
  return denom === 0 ? 0 : dot(a, b) / denom;
}

function topK(queryVec, items, { k = 5, minScore = 0 } = {}) {
  return items
    .map((item) => ({
      item,
      score: cosineSimilarity(queryVec, item.embedding),
    }))
    .filter((r) => r.score >= minScore)
    .sort((x, y) => y.score - x.score)
    .slice(0, k);
}

module.exports = { cosineSimilarity, topK };
