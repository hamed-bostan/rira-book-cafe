import { z } from "zod";

/**
 * What an image field accepts: an absolute http(s) URL (an external image) or a
 * path on this site (`/uploads/...` for uploads, `/images/...` for the bundled
 * sample images the seed uses). Protocol-relative (`//host`) and other schemes are refused.
 */
export function isImageUrl(value: string): boolean {
  if (/^\/(?!\/)/.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** A required image field; messages are `formErrors` keys. */
export const imageUrlField = (requiredKey: string) =>
  z.string().trim().min(1, requiredKey).refine(isImageUrl, "imageInvalid");
