import { readFile } from "node:fs/promises";
import path from "node:path";

import { resolveStoredImageFile } from "@/src/infrastructure/container";
import { IMAGE_EXTENSION_BY_MIME } from "@/src/infrastructure/repositories/LocalDiskImageStorageRepository";
import { requestLogger } from "@/src/lib/api/requestLogger";
import { detectImageType } from "@/src/lib/detectImageType";

const MIME_BY_EXTENSION: Record<string, string> = Object.fromEntries(
  Object.entries(IMAGE_EXTENSION_BY_MIME).map(([mime, extension]) => [`.${extension}`, mime]),
);

type RouteContext = { params: Promise<{ path: string[] }> };

/**
 * Serves uploaded images from disk: `GET /uploads/<folder>/<uuid>.<ext>`.
 * Names are random UUIDs and never rewritten, so responses are cached forever.
 * Only raster image extensions are served (never SVG or HTML), and paths can't
 * escape the uploads root.
 *
 * Defence in depth against a stored file that isn't what its name says (uploads
 * are sniffed on the way in, but files can reach the volume other ways): the bytes
 * must sniff as the type the extension claims, the type is never left to the
 * browser to guess (`nosniff`), and a lock-down CSP + `sandbox` neuters it should
 * it ever be opened as a document.
 */
export async function GET(request: Request, { params }: RouteContext): Promise<Response> {
  const segments = (await params).path;
  const contentType = MIME_BY_EXTENSION[path.extname(segments.at(-1) ?? "").toLowerCase()];
  const file = contentType ? resolveStoredImageFile(segments.join("/")) : null;
  if (!file) return new Response("Not found", { status: 404 });

  try {
    const body = await readFile(file);
    if (detectImageType(body) !== contentType) return new Response("Not found", { status: 404 });

    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; sandbox",
      },
    });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    // Missing, or a directory named like an image.
    if (code === "ENOENT" || code === "EISDIR") return new Response("Not found", { status: 404 });
    requestLogger(request).error("Serving upload failed", { error, path: segments.join("/") });
    return new Response("Server error", { status: 500 });
  }
}
