import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  IImageStorageRepository,
  StoredImage,
  StoredObject,
  UploadImageInput,
} from "@/src/domain/repositories/IImageStorageRepository";

/** Supabase Storage's `list` caps each page at 100 objects. */
const LIST_PAGE_SIZE = 100;

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export type SupabaseImageStorageConfig = {
  /** Project URL, e.g. `https://xxxx.supabase.co`. */
  url: string;
  /**
   * Service-role (secret) key. Bypasses RLS — MUST stay server-side only. The
   * repository is bound into route handlers via the container, never imported
   * by client components.
   */
  serviceRoleKey: string;
  /** Storage bucket name. */
  bucket: string;
}

/**
 * Image storage backed by Supabase Storage. Runs server-side only — it holds the
 * service-role key, which is what lets it write to the bucket while RLS keeps the
 * client (anon key) read-only. The bucket is public, so reads need no key at all.
 */
export class SupabaseImageStorageRepository implements IImageStorageRepository {
  private clientInstance: SupabaseClient | null = null;

  constructor(private readonly config: SupabaseImageStorageConfig) {}

  /**
   * The Supabase client is created on first use, not in the constructor, so that
   * importing the container (e.g. while `next build` collects page data) never
   * needs the runtime Supabase env — those vars are only present once a request
   * actually reaches an image route. Building the client eagerly would throw
   * ("supabaseUrl is required") whenever the env is absent, as it is at build.
   */
  private get client(): SupabaseClient {
    if (!this.clientInstance) {
      const { url, serviceRoleKey } = this.config;
      if (!url || !serviceRoleKey) {
        throw new Error(
          "SupabaseImageStorage: SUPABASE_URL and SUPABASE_SECRET_KEY must be set to use image storage.",
        );
      }
      this.clientInstance = createClient(url, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
    return this.clientInstance;
  }

  async upload(input: UploadImageInput): Promise<StoredImage> {
    const extension = EXTENSION_BY_MIME[input.contentType];
    if (!extension) {
      throw new Error(`SupabaseImageStorage: unsupported content type "${input.contentType}".`);
    }

    const path = buildObjectPath(input.folder, extension);

    const { error } = await this.client.storage.from(this.config.bucket).upload(path, input.data, {
      contentType: input.contentType,
      // Generated paths are unique, so this never clobbers; keep it explicit.
      upsert: false,
    });

    if (error) {
      throw new Error(`SupabaseImageStorage: upload failed — ${error.message}`);
    }

    return { path, url: this.getPublicUrl(path) };
  }

  async remove(path: string): Promise<void> {
    const { error } = await this.client.storage.from(this.config.bucket).remove([path]);
    if (error) {
      throw new Error(`SupabaseImageStorage: remove failed — ${error.message}`);
    }
  }

  async removeByUrl(url: string): Promise<void> {
    const path = this.pathForUrl(url);
    if (!path) return; // External/legacy URL we don't own — nothing to reclaim.

    try {
      const { error } = await this.client.storage.from(this.config.bucket).remove([path]);
      if (error) {
        console.error(`SupabaseImageStorage: best-effort remove failed for "${path}" — ${error.message}`);
      }
    } catch (error) {
      // Network/SDK failure: log and move on — cleanup must never break the caller.
      console.error(`SupabaseImageStorage: best-effort remove threw for "${path}":`, error);
    }
  }

  async list(folder: string): Promise<StoredObject[]> {
    const bucket = this.client.storage.from(this.config.bucket);
    const objects: StoredObject[] = [];

    for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
      const { data, error } = await bucket.list(folder, {
        limit: LIST_PAGE_SIZE,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) {
        throw new Error(`SupabaseImageStorage: list failed for "${folder}" — ${error.message}`);
      }
      if (!data || data.length === 0) break;

      for (const item of data) {
        // Sub-folder placeholders come back with a null id and no metadata — skip them.
        if (!item.id) continue;
        const path = `${folder}/${item.name}`;
        objects.push({
          path,
          url: this.getPublicUrl(path),
          createdAt: item.created_at ? new Date(item.created_at) : null,
        });
      }

      if (data.length < LIST_PAGE_SIZE) break;
    }

    return objects;
  }

  getPublicUrl(path: string): string {
    return this.client.storage.from(this.config.bucket).getPublicUrl(path).data.publicUrl;
  }

  /** Extract the in-bucket path from one of our public URLs, or null if it isn't one. */
  pathForUrl(url: string): string | null {
    const marker = `/storage/v1/object/public/${this.config.bucket}/`;
    const index = url.indexOf(marker);
    if (index === -1) return null;

    const encodedPath = url.slice(index + marker.length).split("?")[0];
    if (!encodedPath) return null;

    try {
      return decodeURIComponent(encodedPath);
    } catch {
      return encodedPath; // Malformed escapes — fall back to the raw path.
    }
  }
}

/** `<folder>/<uuid>.<ext>`, with the folder segment omitted when not given. */
function buildObjectPath(folder: string | undefined, extension: string): string {
  const name = `${crypto.randomUUID()}.${extension}`;
  const segment = folder?.replace(/^\/+|\/+$/g, "");
  return segment ? `${segment}/${name}` : name;
}
