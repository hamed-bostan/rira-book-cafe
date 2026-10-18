import { z } from "zod";

import { isImageUrl } from "@/src/contracts/image-url";

/**
 * `POST /images/upload` — the public URL of the stored image, validated at the
 * typed-service boundary (see `parseApiResponse`). The URL is saved straight onto a
 * category, product or profile, so a body that isn't this envelope would otherwise
 * be persisted as `undefined`.
 *
 * Same rule as the forms' image fields (`isImageUrl`): self-hosted uploads come back
 * as a root-relative `/uploads/...` path, which `z.string().url()` would refuse.
 */
export const imageUploadResponseSchema = z.object({
  image: z.object({ url: z.string().refine(isImageUrl) }),
});
