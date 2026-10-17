export type LimitedBody = { ok: true; bytes: Uint8Array<ArrayBuffer> } | { ok: false; reason: "too-large" | "unreadable" };

/**
 * Read a request body into memory, refusing once it passes `maxBytes` — before
 * buffering the rest. `request.formData()` / `arrayBuffer()` would read an
 * arbitrarily large body first and only then let the caller check its size.
 *
 * A declared `Content-Length` over the limit is refused without reading at all;
 * a chunked (or lying) body is cut off mid-stream.
 */
export async function readBodyWithLimit(request: Request, maxBytes: number): Promise<LimitedBody> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, reason: "too-large" };
  if (!request.body) return { ok: true, bytes: new Uint8Array(0) };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { ok: false, reason: "too-large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: "unreadable" };
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes };
}
