import { describe, expect, it, vi } from "vitest";

import { reclaimImage } from "../reclaimImage";

/** Storage that owns `/uploads/…` only, like the disk store. */
function storage() {
  return {
    pathForUrl: vi.fn((url: string) => (url.startsWith("/uploads/") ? url.slice("/uploads/".length) : null)),
    removeByUrl: vi.fn(async () => undefined),
  };
}

describe("reclaimImage", () => {
  it("deletes an uploaded file nothing refers to any more", async () => {
    const store = storage();
    const references = { isReferenced: vi.fn(async () => false) };
    await reclaimImage("/uploads/products/a.webp", references, store);
    expect(references.isReferenced).toHaveBeenCalledWith("/uploads/products/a.webp");
    expect(store.removeByUrl).toHaveBeenCalledWith("/uploads/products/a.webp");
  });

  it("keeps a file something still uses (an order line's snapshot, another item)", async () => {
    const store = storage();
    await reclaimImage("/uploads/products/a.webp", { isReferenced: async () => true }, store);
    expect(store.removeByUrl).not.toHaveBeenCalled();
  });

  it("never touches a seed picture or an external URL — they aren't the store's", async () => {
    const store = storage();
    const references = { isReferenced: vi.fn(async () => false) };
    await reclaimImage("/images/seed/latte.webp", references, store);
    await reclaimImage("https://cdn.example.com/latte.png", references, store);
    expect(references.isReferenced).not.toHaveBeenCalled();
    expect(store.removeByUrl).not.toHaveBeenCalled();
  });

  it("keeps the file when the reference check fails, and doesn't throw", async () => {
    const store = storage();
    const references = {
      isReferenced: vi.fn(async (): Promise<boolean> => {
        throw new Error("db down");
      }),
    };
    await expect(reclaimImage("/uploads/products/a.webp", references, store)).resolves.toBeUndefined();
    expect(store.removeByUrl).not.toHaveBeenCalled();
  });

  it("does nothing for an empty URL", async () => {
    const store = storage();
    await reclaimImage(undefined, { isReferenced: async () => false }, store);
    await reclaimImage("", { isReferenced: async () => false }, store);
    expect(store.pathForUrl).not.toHaveBeenCalled();
  });
});
