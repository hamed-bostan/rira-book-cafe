import { describe, expect, it, vi } from "vitest";

import { UploadImage } from "../UploadImage";

import type { IImageStorageRepository, StoredImage } from "../../../repositories/IImageStorageRepository";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

function setup(): { useCase: UploadImage; upload: ReturnType<typeof vi.fn<IImageStorageRepository["upload"]>> } {
  const upload = vi.fn<IImageStorageRepository["upload"]>(async (): Promise<StoredImage> => ({ path: "products/x.png", url: "https://cdn/products/x.png" }));
  return { useCase: new UploadImage({ upload } as unknown as IImageStorageRepository), upload };
}

describe("UploadImage", () => {
  it("stores the image under the sniffed type, not the declared one", async () => {
    const { useCase, upload } = setup();
    const stored = await useCase.execute({ data: PNG, contentType: "image/jpeg", folder: "products", fileName: "x.jpg" });
    expect(stored.url).toBe("https://cdn/products/x.png");
    expect(upload).toHaveBeenCalledWith({ data: PNG, contentType: "image/png", folder: "products", fileName: "x.jpg" });
  });

  it("accepts a raw ArrayBuffer", async () => {
    const { useCase, upload } = setup();
    await useCase.execute({ data: PNG.slice().buffer, contentType: "image/png" });
    expect(upload.mock.calls[0][0].contentType).toBe("image/png");
  });

  it.each<[string, Uint8Array, RegExp]>([
    ["an empty file", new Uint8Array(0), /empty/],
    ["a file over 5 MB", new Uint8Array(5 * 1024 * 1024 + 1), /byte limit/],
    ["bytes that aren't an image", new TextEncoder().encode("<svg onload=alert(1)>"), /not a supported image/],
  ])("refuses %s before storing anything", async (_label, data, message) => {
    const { useCase, upload } = setup();
    await expect(async () => useCase.execute({ data, contentType: "image/png" })).rejects.toThrow(message);
    expect(upload).not.toHaveBeenCalled();
  });
});
