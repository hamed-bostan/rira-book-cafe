import { readFile } from "node:fs/promises";
import path from "node:path";

import { resolveStoredImageFile } from "@/src/infrastructure/container";
import { IMAGE_EXTENSION_BY_MIME } from "@/src/infrastructure/repositories/LocalDiskImageStorageRepository";
import { requestLogger } from "@/src/lib/api/requestLogger";
import { detectImageType } from "@/src/lib/detectImageType";
import { RECEIPT_IMAGE_FOLDER } from "@/src/lib/imageFolders";
import { getSessionWith } from "@/src/lib/require-permission";

const MIME_BY_EXTENSION: Record<string, string> = Object.fromEntries(
  Object.entries(IMAGE_EXTENSION_BY_MIME).map(([mime, extension]) => [`.${extension}`, mime]),
);

type RouteContext = { params: Promise<{ path: string[] }> };

/**
 * Whether a stored path lands in the receipts folder. Asked of the normalized path,
 * not the first segment: `products/..%2Freceipts/x.png` resolves to the same file.
 */
function isReceiptPath(objectPath: string): boolean {
  return path.normalize(objectPath).split(path.sep)[0] === RECEIPT_IMAGE_FOLDER;
}

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
 *
 * Receipts are the exception to "public": they're financial records, so only
 * `accounting.view` reads them, nothing caches them, and anyone else gets the same
 * 404 as for a file that isn't there.
 */
export async function GET(request: Request, { params }: RouteContext): Promise<Response> {
  const segments = (await params).path;
  const objectPath = segments.join("/");
  const contentType = MIME_BY_EXTENSION[path.extname(segments.at(-1) ?? "").toLowerCase()];
  const file = contentType ? resolveStoredImageFile(objectPath) : null;
  if (!file) return new Response("Not found", { status: 404 });

  const isReceipt = isReceiptPath(objectPath);
  if (isReceipt && !(await getSessionWith("accounting.view"))) return new Response("Not found", { status: 404 });

  try {
    const body = await readFile(file);
    if (detectImageType(body) !== contentType) return new Response("Not found", { status: 404 });

    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": isReceipt ? "private, no-store" : "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; sandbox",
      },
    });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    // Missing, or a directory named like an image.
    if (code === "ENOENT" || code === "EISDIR") return new Response("Not found", { status: 404 });
    requestLogger(request).error("Serving upload failed", { error, path: objectPath });
    return new Response("Server error", { status: 500 });
  }
}
