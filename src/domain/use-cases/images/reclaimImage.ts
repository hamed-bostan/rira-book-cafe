import type { IImageReferences } from "../../repositories/IImageReferences";
import type { IImageStorageRepository } from "../../repositories/IImageStorageRepository";

/**
 * Delete an image file nothing uses any more — called once the write that stopped
 * using it has committed (a picture replaced, an item deleted).
 *
 * Best-effort and conservative, in that order of priority:
 * - It never throws: the save or delete that triggered it already happened, and a
 *   leftover file costs some disk, where a failed request would cost the edit.
 * - It only touches files this app's storage owns (`pathForUrl`): the seed pictures
 *   under `/images/seed` (and any external URL) are never ours to delete.
 * - It keeps any file something still refers to — another item, an order line that
 *   snapshotted the picture, a category, an event, a profile. When that can't be
 *   checked (the lookup fails), the file stays.
 */
export async function reclaimImage(
  url: string | null | undefined,
  references: IImageReferences,
  storage: Pick<IImageStorageRepository, "pathForUrl" | "removeByUrl">,
): Promise<void> {
  if (!url || storage.pathForUrl(url) === null) return;
  try {
    if (await references.isReferenced(url)) return;
  } catch {
    // Unknown is "still used": better a stray file than a broken picture.
    return;
  }
  await storage.removeByUrl(url);
}
