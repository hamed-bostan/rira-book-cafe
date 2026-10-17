import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LocalDiskImageStorageRepository } from "../LocalDiskImageStorageRepository";

describe("LocalDiskImageStorageRepository", () => {
  let root: string;
  let storage: LocalDiskImageStorageRepository;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "rira-uploads-"));
    storage = new LocalDiskImageStorageRepository({ rootDir: root, publicPathPrefix: "/uploads" });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("writes the bytes under the folder and returns a site-relative URL", async () => {
    const image = await storage.upload({ data: new Uint8Array([1, 2, 3]), contentType: "image/png", folder: "products" });

    expect(image.path).toMatch(/^products\/[0-9a-f-]{36}\.png$/);
    expect(image.url).toBe(`/uploads/${image.path}`);
    expect([...(await readFile(path.join(root, image.path)))]).toEqual([1, 2, 3]);
  });

  it("refuses unsupported content types", async () => {
    await expect(storage.upload({ data: new Uint8Array([1]), contentType: "image/svg+xml" })).rejects.toThrow(
      /unsupported content type/,
    );
  });

  it("lists a folder and removes by URL", async () => {
    const image = await storage.upload({ data: new Uint8Array([1]), contentType: "image/webp", folder: "categories" });

    expect((await storage.list("categories")).map((object) => object.path)).toEqual([image.path]);
    expect(await storage.list("missing")).toEqual([]);

    await storage.removeByUrl(`https://cafe.example${image.url}`);
    expect(await storage.list("categories")).toEqual([]);
  });

  it("maps only its own, non-escaping URLs back to paths", () => {
    expect(storage.pathForUrl("/uploads/products/a.png")).toBe("products/a.png");
    expect(storage.pathForUrl("/images/seed/a.svg")).toBeNull();
    expect(storage.pathForUrl("/uploads/..%2F..%2Fetc%2Fpasswd")).toBeNull();
    expect(storage.resolve("../outside.png")).toBeNull();
  });
});
