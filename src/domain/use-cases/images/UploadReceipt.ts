import { detectReceiptType } from "../../../lib/detectReceiptType";
import { RECEIPT_IMAGE_FOLDER } from "../../../lib/imageFolders";
import { ValidationError } from "../../errors/ValidationError";

import type {
  IImageStorageRepository,
  StoredImage,
  UploadImageInput,
} from "../../repositories/IImageStorageRepository";

/** Largest receipt accepted (10 MB): a full-size phone photo of a long bill, or a scanned PDF. */
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

/**
 * Store an expense's receipt in the private receipts folder: a photo or scan, or the
 * PDF a supplier sent. This is the only upload that takes a PDF, so no document ever
 * lands in a public folder.
 */
export class UploadReceipt {
  constructor(private readonly imageStorage: IImageStorageRepository) {}

  execute(input: Omit<UploadImageInput, "folder">): Promise<StoredImage> {
    const byteLength = input.data.byteLength;
    if (byteLength === 0) {
      throw new ValidationError("file", "The receipt is empty.");
    }
    if (byteLength > MAX_RECEIPT_BYTES) {
      throw new ValidationError("file", "The receipt is larger than 10 MB.");
    }

    // As with images: the bytes decide the type, never the caller's content type.
    const detected = detectReceiptType(input.data);
    if (!detected) {
      throw new ValidationError("file", "The file isn't a JPEG, PNG, WebP or AVIF image, or a PDF.");
    }

    return this.imageStorage.upload({ ...input, folder: RECEIPT_IMAGE_FOLDER, contentType: detected });
  }
}
