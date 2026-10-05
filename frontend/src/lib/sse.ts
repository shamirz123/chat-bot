import type { SSEPayload } from "./types";

/**
 * Splits a text buffer into complete SSE events and returns the unconsumed
 * remainder. Network chunks can cut an event in half, so callers keep `rest`
 * and prepend it to the next chunk.
 */
export function parseSSE(buffer: string): { events: SSEPayload[]; rest: string } {
  const events: SSEPayload[] = [];
  let rest = buffer;
  let idx: number;

  while ((idx = rest.indexOf("\n\n")) !== -1) {
    const rawEvent = rest.slice(0, idx).trim();
    rest = rest.slice(idx + 2);

    const data = rawEvent
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.replace(/^data:\s?/, ""))
      .join("");

    if (!data || data === "[DONE]") continue;
    try {
      events.push(JSON.parse(data) as SSEPayload);
    } catch {
      // Ignore malformed events rather than killing the whole stream.
    }
  }

  return { events, rest };
}

/** Reads a streaming fetch Response, invoking onEvent for each SSE payload. */
export async function readSSE(
  response: Response,
  onEvent: (event: SSEPayload) => void
): Promise<void> {
  if (!response.body) throw new Error("Response has no body");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const parsed = parseSSE(buffer + decoder.decode(value, { stream: true }));
    buffer = parsed.rest;
    parsed.events.forEach(onEvent);
  }
}
