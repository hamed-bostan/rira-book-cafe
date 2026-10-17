import { readFile } from "node:fs/promises";
import path from "node:path";

import { resolveStoredImageFile } from "@/src/infrastructure/container";
import { IMAGE_EXTENSION_BY_MIME } from "@/src/infrastructure/repositories/LocalDiskImageStorageRepository";
import { requestLogger } from "@/src/lib/api/requestLogger";

const MIME_BY_EXTENSION: Record<string, string> = Object.fromEntries(
  Object.entries(IMAGE_EXTENSION_BY_MIME).map(([mime, extension]) => [`.${extension}`, mime]),
);

type RouteContext = { params: Promise<{ path: string[] }> };

/**
 * Serves uploaded images from disk: `GET /uploads/<folder>/<uuid>.<ext>`.
 * Names are random UUIDs and never rewritten, so responses are cached forever.
 * Only image extensions are served, and paths can't escape the uploads root.
 */
export async function GET(request: Request,{ params }: RouteContext): Promise<Response> {
  const segments = (await params).path;
  const contentType = MIME_BY_EXTENSION[path.extname(segments.at(-1) ?? "").toLowerCase()];
  const file = contentType ? resolveStoredImageFile(segments.join("/")) : null;
  if (!file) return new Response("Not found", { status: 404 });

  try {
    const body = await readFile(file);
    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Response("Not found", { status: 404 });
    requestLogger(request).error("Serving upload failed", { error, path: segments.join("/") });
    return new Response("Server error", { status: 500 });
  }
}
