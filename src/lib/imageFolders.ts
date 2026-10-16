/**
 * The bucket sub-folders the app uploads into — and, by the same token, the only
 * folders the orphan sweep scans. Shared so the upload allowlist and the sweep
 * can never drift apart.
 */
export const MANAGED_IMAGE_FOLDERS = ["products", "categories", "misc"] as const;

export type ManagedImageFolder = (typeof MANAGED_IMAGE_FOLDERS)[number];

/**
 * Where user-uploaded profile pictures go. Deliberately *not* a managed folder:
 * the orphan sweep reconciles against catalog references (categories/products)
 * and knows nothing about avatars, so listing it there would delete every
 * avatar. Avatars are reclaimed instead when a profile swaps its picture
 * (`UpdateProfile` → `removeByUrl`).
 */
export const AVATAR_IMAGE_FOLDER = "avatars";

/** Every folder an upload may target — the allowlist the route enforces. */
export type ImageFolder = ManagedImageFolder | typeof AVATAR_IMAGE_FOLDER;
