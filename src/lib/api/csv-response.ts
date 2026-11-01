import { toCsv, type CsvCell } from "../csv";

/** A download, and financial: nothing between here and the browser may keep a copy. */
function csvHeaders(fileName: string): HeadersInit {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${fileName}"`,
    "Cache-Control": "private, no-store",
  };
}

/** A file small enough to build in one go: a statement. */
export function csvResponse(fileName: string, rows: readonly (readonly CsvCell[])[]): Response {
  return new Response(toCsv(rows), { headers: csvHeaders(fileName) });
}

/**
 * A file that may not be: a year of the journal is hundreds of thousands of lines.
 * Each chunk is read only when the client is ready for it, so it never sits in
 * memory whole. A read failing mid-file aborts the download rather than ending it
 * as if it were complete.
 */
export function csvStreamResponse(fileName: string, chunks: AsyncIterable<string>): Response {
  const iterator = chunks[Symbol.asyncIterator]();
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const next = await iterator.next();
      if (next.done) controller.close();
      else controller.enqueue(encoder.encode(next.value));
    },
    async cancel() {
      await iterator.return?.();
    },
  });
  return new Response(body, { headers: csvHeaders(fileName) });
}
