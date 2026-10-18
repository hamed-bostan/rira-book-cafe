import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  IImageStorageRepository,
  StoredImage,
  StoredObject,
  UploadImageInput,
} from "@/src/domain/repositories/IImageStorageRepository";
import type { ILogger } from "@/src/domain/repositories/ILogger";

export const IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export type LocalDiskImageStorageConfig = {
  /** Absolute directory the images are written to (a Docker volume in production). */
  rootDir: string;
  /** Site path the files are served under, e.g. `/uploads` (see `app/uploads/[...path]/route.ts`). */
  publicPathPrefix: string;
};

/**
 * Image storage on the server's own disk — the self-hosted replacement for a
 * cloud bucket. Objects live under `rootDir/<folder>/<uuid>.<ext>` and are
 * served by this app at `<publicPathPrefix>/<folder>/<uuid>.<ext>`, so stored
 * URLs are site-relative and survive a domain change.
 */
export class LocalDiskImageStorageRepository implements IImageStorageRepository {
  private readonly root: string;
  private readonly prefix: string;

  constructor(
    config: LocalDiskImageStorageConfig,
    private readonly logger: ILogger,
  ) {
    this.root = path.resolve(config.rootDir);
    this.prefix = `/${config.publicPathPrefix.replace(/^\/+|\/+$/g, "")}/`;
  }

  async upload(input: UploadImageInput): Promise<StoredImage> {
    const extension = IMAGE_EXTENSION_BY_MIME[input.contentType];
    if (!extension) {
      throw new Error(`LocalDiskImageStorage: unsupported content type "${input.contentType}".`);
    }

    const objectPath = buildObjectPath(input.folder, extension);
    const absolute = this.resolve(objectPath);
    if (!absolute) throw new Error(`LocalDiskImageStorage: invalid folder "${input.folder}".`);

    const bytes = input.data instanceof Uint8Array ? input.data : new Uint8Array(input.data);
    await mkdir(path.dirname(absolute), { recursive: true });
    // `wx` fails rather than clobbers; generated paths are unique anyway.
    await writeFile(absolute, bytes, { flag: "wx" });

    return { path: objectPath, url: this.getPublicUrl(objectPath) };
  }

  async remove(objectPath: string): Promise<void> {
    const absolute = this.resolve(objectPath);
    if (!absolute) throw new Error(`LocalDiskImageStorage: invalid path "${objectPath}".`);
    await rm(absolute, { force: true });
  }

  async removeByUrl(url: string): Promise<void> {
    const objectPath = this.pathForUrl(url);
    if (!objectPath) return; // External/legacy URL we don't own — nothing to reclaim.

    try {
      await this.remove(objectPath);
    } catch (error) {
      // Cleanup must never break the caller.
      this.logger.error("Best-effort image removal failed", { error, objectPath });
    }
  }

  async list(folder: string): Promise<StoredObject[]> {
    const directory = this.resolve(folder);
    if (!directory) throw new Error(`LocalDiskImageStorage: invalid folder "${folder}".`);

    let names: string[];
    try {
      names = await readdir(directory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }

    const objects: StoredObject[] = [];
    for (const name of names.sort()) {
      const objectPath = `${trimSlashes(folder)}/${name}`;
      const info = await stat(path.join(directory, name));
      if (!info.isFile()) continue;
      objects.push({ path: objectPath, url: this.getPublicUrl(objectPath), createdAt: info.birthtime ?? info.mtime });
    }
    return objects;
  }

  getPublicUrl(objectPath: string): string {
    return `${this.prefix}${objectPath.split("/").map(encodeURIComponent).join("/")}`;
  }

  pathForUrl(url: string): string | null {
    // Accept both the stored site-relative form and an absolute URL on any host.
    let pathname = url;
    if (!url.startsWith("/")) {
      try {
        pathname = new URL(url).pathname;
      } catch {
        return null;
      }
    }
    if (!pathname.startsWith(this.prefix)) return null;

    const encoded = pathname.slice(this.prefix.length).split("?")[0];
    if (!encoded) return null;

    let decoded: string;
    try {
      decoded = decodeURIComponent(encoded);
    } catch {
      return null;
    }
    return this.resolve(decoded) ? decoded : null;
  }

  /** Absolute file path for an object path, or null when it escapes the root. */
  resolve(objectPath: string): string | null {
    const absolute = path.resolve(this.root, objectPath);
    return absolute.startsWith(this.root + path.sep) ? absolute : null;
  }
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

/** `<folder>/<uuid>.<ext>`, with the folder segment omitted when not given. */
function buildObjectPath(folder: string | undefined, extension: string): string {
  const name = `${crypto.randomUUID()}.${extension}`;
  const segment = folder ? trimSlashes(folder) : "";
  return segment ? `${segment}/${name}` : name;
}
