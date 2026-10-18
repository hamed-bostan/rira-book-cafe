import { NextResponse, type NextRequest } from "next/server";

import { ValidationError } from "@/src/domain/errors/ValidationError";
import { MAX_IMAGE_BYTES, UploadImage } from "@/src/domain/use-cases/images/UploadImage";
import { imageStorageRepository } from "@/src/infrastructure/container";
import { enforceRateLimit, RATE_LIMITS } from "@/src/lib/api/rate-limit";
import { readBodyWithLimit } from "@/src/lib/api/read-body";
import { requestLogger } from "@/src/lib/api/requestLogger";
import { errorResponse, errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { AVATAR_IMAGE_FOLDER, MANAGED_IMAGE_FOLDERS } from "@/src/lib/imageFolders";
import { getUserSession } from "@/src/lib/require-auth";
import { getSessionWith } from "@/src/lib/require-permission";

const ADMIN_FOLDERS = new Set<string>(MANAGED_IMAGE_FOLDERS);
const ALLOWED_FOLDERS = new Set<string>([...MANAGED_IMAGE_FOLDERS, AVATAR_IMAGE_FOLDER]);

/** The image limit plus room for the multipart envelope (boundaries, part headers, `folder`). */
const MAX_BODY_BYTES = MAX_IMAGE_BYTES + 64 * 1024;

/**
 * Image upload endpoint: `POST /api/images/upload` with `multipart/form-data`
 * (`file`, optional `folder`). The file is written to the server's disk here,
 * server-side (see `LocalDiskImageStorageRepository`), and served from `/uploads`.
 *
 * Authorization is per-folder: the catalog folders (products/categories/misc)
 * are admin-only — they back the storefront and feed the orphan sweep. The
 * `avatars` folder is open to any signed-in user uploading their own profile
 * picture. Anonymous callers can never write to a billable, service-role bucket.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Decide which session this caller has up front; the folder check below picks
  // the right requirement. (Admins satisfy the user check too.)
  const [catalogSession, eventsSession, userSession] = await Promise.all([
    getSessionWith("catalog.write"),
    getSessionWith("events.manage"),
    getUserSession(),
  ]);
  if (!catalogSession && !eventsSession && !userSession) return unauthorizedResponse();

  const limited = await enforceRateLimit(request, RATE_LIMITS.imageUpload, userSession?.user.id);
  if (limited) return limited;

  // Cap the body *before* buffering it: `request.formData()` alone would read an
  // arbitrarily large upload into memory first.
  const body = await readBodyWithLimit(request, MAX_BODY_BYTES);
  if (!body.ok) {
    return body.reason === "too-large"
      ? errorResponse(413, { message: "The image is larger than 5 MB.", code: "PAYLOAD_TOO_LARGE" })
      : errorResponse(400, { message: "Expected multipart/form-data.", code: "BAD_REQUEST" });
  }

  let formData: FormData;
  try {
    formData = await new Response(body.bytes, {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    return errorResponse(400, { message: "Expected multipart/form-data.", code: "BAD_REQUEST" });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return errorResponse(400, { message: "Missing 'file'.", code: "VALIDATION", fieldErrors: { file: "Required." } });
  }

  const folderRaw = formData.get("folder");
  const folder = typeof folderRaw === "string" && folderRaw ? folderRaw : undefined;
  if (folder && !ALLOWED_FOLDERS.has(folder)) {
    return errorResponse(400, { message: `Unknown folder "${folder}".`, code: "VALIDATION" });
  }

  // An unspecified folder (or any managed catalog folder) is admin-only; only the
  // `avatars` folder is reachable by a non-admin signed-in user.
  // Event images need `events.manage`; every other managed folder needs the catalog.
  const writer = folder === "events" ? eventsSession : catalogSession;
  if ((!folder || ADMIN_FOLDERS.has(folder)) && !writer) return unauthorizedResponse();

  try {
    const image = await new UploadImage(imageStorageRepository).execute({
      data: await file.arrayBuffer(),
      contentType: file.type,
      folder,
      fileName: file.name,
    });
    return NextResponse.json({ image }, { status: 201 });
  } catch (error) {
    // Empty, oversized or not an image — the client's fault, answered 400.
    if (error instanceof ValidationError) return errorResponseFromException(error, "Image upload rejected");
    requestLogger(request).error("Image upload failed", { error, folder });
    return errorResponse(502, { message: "Image upload failed. Please try again.", code: "UPLOAD_FAILED" });
  }
}
