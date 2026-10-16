import { z } from "zod";

/**
 * `POST /images/upload` — the public URL of the stored image, validated at the
 * typed-service boundary (see `parseApiResponse`). The URL is saved straight onto a
 * category, product or profile, so a body that isn't this envelope would otherwise
 * be persisted as `undefined`.
 */
export const imageUploadResponseSchema = z.object({
  image: z.object({ url: z.string().url() }),
});
