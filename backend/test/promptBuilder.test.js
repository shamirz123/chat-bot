require("./helpers");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  buildUserTurn,
  buildRetrievalQuery,
  toGeminiHistory,
  toPublicSources,
  MAX_HISTORY_MESSAGES,
} = require("../services/promptBuilder");

const src = (text, docName = "CV", score = 0.71234) => ({ text, docName, score });

test("buildUserTurn returns the bare message when nothing was retrieved", () => {
  assert.equal(buildUserTurn("hi", []), "hi");
});

test("buildUserTurn numbers sources so the model can cite them", () => {
  const turn = buildUserTurn("Where did he work?", [src("Worked at A"), src("Worked at B", "notes.md")]);
  assert.match(turn, /\[1\] \(CV\)\nWorked at A/);
  assert.match(turn, /\[2\] \(notes\.md\)\nWorked at B/);
  assert.match(turn, /Question: Where did he work\?$/);
});

test("toGeminiHistory maps roles, keeps only the latest window and starts with a user turn", () => {
  const messages = Array.from({ length: MAX_HISTORY_MESSAGES + 5 }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "shamirbot",
    content: `m${i}`,
  }));
  const history = toGeminiHistory(messages);
  assert.ok(history.length <= MAX_HISTORY_MESSAGES);
  assert.equal(history[0].role, "user");
  assert.ok(history.every((h) => h.role === "user" || h.role === "model"));
  assert.equal(history.at(-1).parts[0].text, `m${messages.length - 1}`);
});

test("toGeminiHistory drops a leading model turn left by windowing", () => {
  const history = toGeminiHistory([
    { role: "shamirbot", content: "orphan" },
    { role: "user", content: "q" },
  ]);
  assert.deepEqual(history, [{ role: "user", parts: [{ text: "q" }] }]);
});

test("buildRetrievalQuery enriches short follow-ups with the previous question", () => {
  const prev = [
    { role: "user", content: "Where did Shahmir work?" },
    { role: "shamirbot", content: "At LALA." },
  ];
  assert.equal(buildRetrievalQuery("and before that?", prev), "Where did Shahmir work?\nand before that?");
});

test("buildRetrievalQuery leaves long questions and first questions alone", () => {
  const long = "Describe in detail every project Shahmir has shipped to production";
  assert.equal(buildRetrievalQuery(long, [{ role: "user", content: "x" }]), long);
  assert.equal(buildRetrievalQuery("hi", []), "hi");
});

test("toPublicSources numbers, rounds and truncates; never leaks embeddings", () => {
  const [s] = toPublicSources([{ ...src("a".repeat(500)), embedding: [1, 2, 3] }]);
  assert.deepEqual(Object.keys(s).sort(), ["docName", "excerpt", "n", "score"]);
  assert.equal(s.n, 1);
  assert.equal(s.score, 0.712);
  assert.ok(s.excerpt.length <= 281);
  assert.ok(s.excerpt.endsWith("…"));
});
