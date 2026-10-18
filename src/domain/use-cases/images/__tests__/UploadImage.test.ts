import { describe, expect, it, vi } from "vitest";

import { ValidationError } from "../../../errors/ValidationError";
import { MAX_IMAGE_BYTES, UploadImage } from "../UploadImage";

import type { IImageStorageRepository } from "../../../repositories/IImageStorageRepository";

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function storage(): IImageStorageRepository {
  return {
    upload: vi.fn(async () => ({ path: "products/x.png", url: "/uploads/products/x.png" })),
    remove: vi.fn(),
    removeByUrl: vi.fn(),
    list: vi.fn(),
    getPublicUrl: vi.fn(),
    pathForUrl: vi.fn(),
  };
}

describe("UploadImage", () => {
  it("stores under the sniffed type, ignoring the declared one", async () => {
    const repo = storage();
    await new UploadImage(repo).execute({ data: new Uint8Array(PNG_HEADER), contentType: "image/jpeg" });
    expect(repo.upload).toHaveBeenCalledWith(expect.objectContaining({ contentType: "image/png" }));
  });

  it.each([
    ["empty", new Uint8Array(0)],
    ["oversized", new Uint8Array(MAX_IMAGE_BYTES + 1)],
    ["not an image (HTML)", new TextEncoder().encode("<html><script>alert(1)</script>")],
    ["not an image (SVG)", new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')],
  ])("refuses an %s file with a ValidationError on `file`", (_label, data) => {
    const repo = storage();
    const attempt = (): unknown => new UploadImage(repo).execute({ data, contentType: "image/png" });
    expect(attempt).toThrow(ValidationError);
    expect(attempt).toThrow(expect.objectContaining({ field: "file" }));
    expect(repo.upload).not.toHaveBeenCalled();
  });
});
