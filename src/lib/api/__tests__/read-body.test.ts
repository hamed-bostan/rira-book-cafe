import { describe, expect, it } from "vitest";

import { readBodyWithLimit } from "../read-body";

/** A POST whose body arrives as the given chunks, with no Content-Length (chunked). */
function streamedRequest(chunks: number[]): { request: Request; pulled: () => number } {
  let pulled = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      const size = chunks[pulled];
      if (size === undefined) return controller.close();
      pulled += 1;
      controller.enqueue(new Uint8Array(size).fill(7));
    },
  });
  const request = new Request("http://test/upload", { method: "POST", body: stream, duplex: "half" } as RequestInit);
  return { request, pulled: () => pulled };
}

describe("readBodyWithLimit", () => {
  it("returns the whole body when it fits", async () => {
    const result = await readBodyWithLimit(new Request("http://test", { method: "POST", body: "hello" }), 10);
    expect(result.ok && new TextDecoder().decode(result.bytes)).toBe("hello");
  });

  it("refuses up front when Content-Length declares too much", async () => {
    const request = new Request("http://test", {
      method: "POST",
      body: "x",
      headers: { "content-length": "999999" },
    });
    expect(await readBodyWithLimit(request, 10)).toEqual({ ok: false, reason: "too-large" });
  });

  it("stops reading a streamed body as soon as it passes the limit", async () => {
    const { request, pulled } = streamedRequest([4, 4, 4, 4, 4, 4]);
    expect(await readBodyWithLimit(request, 10)).toEqual({ ok: false, reason: "too-large" });
    expect(pulled()).toBeLessThan(6);
  });

  it("treats a missing body as empty", async () => {
    const result = await readBodyWithLimit(new Request("http://test", { method: "POST" }), 10);
    expect(result).toEqual({ ok: true, bytes: new Uint8Array(0) });
  });
});
