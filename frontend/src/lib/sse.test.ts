import { describe, expect, it } from "vitest";
import { parseSSE, readSSE } from "./sse";

describe("parseSSE", () => {
  it("parses complete events and leaves no remainder", () => {
    const { events, rest } = parseSSE('data: {"delta":"Hel"}\n\ndata: {"delta":"lo"}\n\n');
    expect(events).toEqual([{ delta: "Hel" }, { delta: "lo" }]);
    expect(rest).toBe("");
  });

  it("keeps a partial event as the remainder until the rest arrives", () => {
    const first = parseSSE('data: {"delta":"a"}\n\ndata: {"del');
    expect(first.events).toEqual([{ delta: "a" }]);
    expect(first.rest).toBe('data: {"del');

    const second = parseSSE(first.rest + 'ta":"b"}\n\n');
    expect(second.events).toEqual([{ delta: "b" }]);
    expect(second.rest).toBe("");
  });

  it("parses sources, done and error payloads", () => {
    const sources = [{ n: 1, docName: "CV", excerpt: "text", score: 0.7 }];
    const { events } = parseSSE(
      `data: ${JSON.stringify({ sources })}\n\ndata: {"done":true}\n\ndata: {"error":"busy"}\n\n`
    );
    expect(events).toEqual([{ sources }, { done: true }, { error: "busy" }]);
  });

  it("skips malformed JSON, [DONE] markers and non-data lines without throwing", () => {
    const { events } = parseSSE(
      'data: {not json}\n\ndata: [DONE]\n\n: keep-alive comment\n\ndata: {"delta":"ok"}\n\n'
    );
    expect(events).toEqual([{ delta: "ok" }]);
  });

  it("handles deltas that contain newlines and unicode", () => {
    const { events } = parseSSE(`data: ${JSON.stringify({ delta: "line1\nline2 — ✓" })}\n\n`);
    expect(events).toEqual([{ delta: "line1\nline2 — ✓" }]);
  });
});

describe("readSSE", () => {
  const streamOf = (...chunks: string[]) =>
    new Response(
      new ReadableStream({
        start(controller) {
          const enc = new TextEncoder();
          chunks.forEach((c) => controller.enqueue(enc.encode(c)));
          controller.close();
        },
      })
    );

  it("reassembles events split across network chunks", async () => {
    const received: unknown[] = [];
    await readSSE(
      streamOf('data: {"delta":"Hel', 'lo"}\n\nda', 'ta: {"done":true}\n\n'),
      (e) => received.push(e)
    );
    expect(received).toEqual([{ delta: "Hello" }, { done: true }]);
  });

  it("does not split a multi-byte character across chunks", async () => {
    const bytes = new TextEncoder().encode('data: {"delta":"é"}\n\n');
    const cut = bytes.indexOf(0xc3) + 1; // between the two bytes of "é"
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(bytes.slice(0, cut));
          controller.enqueue(bytes.slice(cut));
          controller.close();
        },
      })
    );
    const received: unknown[] = [];
    await readSSE(response, (e) => received.push(e));
    expect(received).toEqual([{ delta: "é" }]);
  });

  it("propagates errors thrown by the handler", async () => {
    await expect(
      readSSE(streamOf('data: {"error":"boom"}\n\n'), (e) => {
        if (e.error) throw new Error(e.error);
      })
    ).rejects.toThrow("boom");
  });
});
