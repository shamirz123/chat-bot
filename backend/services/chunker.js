const DEFAULT_SIZE = 900;
const DEFAULT_OVERLAP = 150;

function normalize(text) {
  return String(text || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitLong(paragraph, size) {
  if (paragraph.length <= size) return [paragraph];
  const sentences = paragraph.match(/[^.!?\n]+[.!?]*\s*/g) || [paragraph];
  const parts = [];
  let current = "";
  for (const sentence of sentences) {
    if (sentence.length > size) {
      if (current) parts.push(current.trim());
      current = "";
      for (let i = 0; i < sentence.length; i += size) {
        parts.push(sentence.slice(i, i + size).trim());
      }
      continue;
    }
    if (current.length + sentence.length > size) {
      parts.push(current.trim());
      current = "";
    }
    current += sentence;
  }
  if (current.trim()) parts.push(current.trim());
  return parts.filter(Boolean);
}

function chunkText(
  text,
  { size = DEFAULT_SIZE, overlap = DEFAULT_OVERLAP } = {},
) {
  if (overlap >= size) throw new Error("overlap must be smaller than size");

  const units = normalize(text)
    .split(/\n\s*\n/)
    .flatMap((p) => splitLong(p.trim(), size))
    .filter(Boolean);

  const chunks = [];
  let current = "";

  const flush = () => {
    const trimmed = current.trim();
    if (trimmed) chunks.push(trimmed);
  };

  for (const unit of units) {
    if (current && current.length + unit.length + 2 > size) {
      flush();
      const tail = current.slice(-overlap);
      const wordStart = tail.indexOf(" ");
      current = wordStart === -1 ? "" : tail.slice(wordStart + 1);
      if (current.length + unit.length + 2 > size) current = "";
    }
    current += (current ? "\n\n" : "") + unit;
  }
  flush();

  return chunks.map((chunkText, index) => ({ index, text: chunkText }));
}

module.exports = { chunkText, normalize };
