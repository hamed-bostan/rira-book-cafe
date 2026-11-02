import { describe, expect, it, vi } from "vitest";

import { ValidationError } from "../../../errors/ValidationError";
import { MAX_IMAGE_BYTES } from "../UploadImage";
import { MAX_RECEIPT_BYTES, UploadReceipt } from "../UploadReceipt";

import type { IImageStorageRepository } from "../../../repositories/IImageStorageRepository";

const PDF_HEADER = new TextEncoder().encode("%PDF-1.4\n");
const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function storage(): IImageStorageRepository {
  return {
    upload: vi.fn(async () => ({ path: "receipts/x.pdf", url: "/uploads/receipts/x.pdf" })),
    remove: vi.fn(),
    removeByUrl: vi.fn(),
    list: vi.fn(),
    getPublicUrl: vi.fn(),
    pathForUrl: vi.fn(),
  };
}

/** `header` followed by zeros, `size` bytes in all. */
function padded(header: ArrayLike<number>, size: number): Uint8Array {
  const data = new Uint8Array(size);
  data.set(header);
  return data;
}

describe("UploadReceipt", () => {
  it("stores a PDF in the receipts folder, under the sniffed type", async () => {
    const repo = storage();
    await new UploadReceipt(repo).execute({ data: PDF_HEADER, contentType: "image/png" });
    expect(repo.upload).toHaveBeenCalledWith(
      expect.objectContaining({ folder: "receipts", contentType: "application/pdf" }),
    );
  });

  it("takes a photo too, and one larger than an image may be elsewhere", async () => {
    const repo = storage();
    await new UploadReceipt(repo).execute({ data: padded(PNG_HEADER, MAX_IMAGE_BYTES + 1), contentType: "image/png" });
    expect(repo.upload).toHaveBeenCalledWith(expect.objectContaining({ folder: "receipts", contentType: "image/png" }));
  });

  it.each([
    ["empty", new Uint8Array(0)],
    ["oversized", padded(PDF_HEADER, MAX_RECEIPT_BYTES + 1)],
    ["not a receipt (HTML)", new TextEncoder().encode("<html><script>alert(1)</script>")],
    ["not a receipt (SVG)", new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')],
  ])("refuses an %s file with a ValidationError on `file`", (_label, data) => {
    const repo = storage();
    const attempt = (): unknown => new UploadReceipt(repo).execute({ data, contentType: "application/pdf" });
    expect(attempt).toThrow(ValidationError);
    expect(attempt).toThrow(expect.objectContaining({ field: "file" }));
    expect(repo.upload).not.toHaveBeenCalled();
  });
});
