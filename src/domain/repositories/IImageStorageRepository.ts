/** A successfully stored image. */
export type StoredImage = {
  /** Path within the bucket, e.g. `products/3f9a…​.webp`. */
  path: string;
  /** Public CDN URL the client can render directly. */
  url: string;
}

/** An object discovered by listing the bucket (used by orphan cleanup). */
export type StoredObject = {
  /** Path within the bucket, e.g. `categories/3f9a…​.png`. */
  path: string;
  /** Public CDN URL. */
  url: string;
  /** When the object was created, or `null` when the provider didn't report it. */
  createdAt: Date | null;
}

export type UploadImageInput = {
  /** Raw image bytes. */
  data: ArrayBuffer | Uint8Array;
  /** MIME type, e.g. `image/webp`. Used for validation and the stored object. */
  contentType: string;
  /** Optional sub-folder inside the bucket, e.g. `products`. */
  folder?: string;
  /** Original filename — only the extension is used to name the stored object. */
  fileName?: string;
}

/**
 * Boundary between the app and whatever object-storage provider holds images.
 * Implementations live in `infrastructure` and are bound in the container, so
 * swapping Supabase Storage for S3/R2 never touches the domain or UI.
 */
export type IImageStorageRepository = {
  /** Store image bytes and return its path + public URL. */
  upload(input: UploadImageInput): Promise<StoredImage>;
  /** Delete a previously stored object by its bucket path. */
  remove(path: string): Promise<void>;
  /**
   * Best-effort delete by public URL: derives the bucket path from the URL and
   * removes the object. A no-op for URLs this bucket doesn't own, and it never
   * throws — orphan cleanup must not fail the write that triggered it.
   */
  removeByUrl(url: string): Promise<void>;
  /** List every object under a bucket folder (paginated internally). */
  list(folder: string): Promise<StoredObject[]>;
  /** Resolve a bucket path to its public URL without a round-trip. */
  getPublicUrl(path: string): string;
  /** Inverse of {@link getPublicUrl}: the in-bucket path for one of our URLs, or null. */
  pathForUrl(url: string): string | null;
}
