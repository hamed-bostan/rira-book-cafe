import { apiPost } from "@/src/lib/api/client";
import type { ImageFolder } from "@/src/lib/imageFolders";

import { imageUploadResponseSchema } from "./image-response-schema";

/**
 * Typed client for the shared image-upload endpoint (Supabase, written server-side
 * with the service-role key). The one place the multipart upload is expressed: the
 * category and product pickers and the profile avatar flow all call it, and each
 * rejects with an `ApiError` — `401` when the caller may not write to that folder,
 * `EBADRESPONSE` when the body isn't the expected envelope.
 *
 * `folder` is typed to the route's allowlist, so an unknown folder is a compile
 * error rather than a `400` discovered at runtime.
 */
export const imagesApi = {
  /** Upload an image and resolve with its public URL. */
  async upload(file: File, folder: ImageFolder): Promise<string> {
    const body = new FormData();
    body.append("file", file);
    body.append("folder", folder);

    const { image } = await apiPost("/images/upload", body, imageUploadResponseSchema);
    return image.url;
  },
};
