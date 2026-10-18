import { detectImageType } from "../../../lib/detectImageType";
import { ValidationError } from "../../errors/ValidationError";

import type {
  IImageStorageRepository,
  StoredImage,
  UploadImageInput,
} from "../../repositories/IImageStorageRepository";

/** Largest image accepted (5 MB). The upload route caps the request body just above it. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export class UploadImage {
  constructor(private readonly imageStorage: IImageStorageRepository) {}

  execute(input: UploadImageInput): Promise<StoredImage> {
    const byteLength = input.data.byteLength;
    if (byteLength === 0) {
      throw new ValidationError("file", "The image is empty.");
    }
    if (byteLength > MAX_IMAGE_BYTES) {
      throw new ValidationError("file", "The image is larger than 5 MB.");
    }

    // Trust the bytes, not the caller-declared content type (which is spoofable):
    // sniff the real format and reject anything that isn't a supported image.
    const detected = detectImageType(input.data);
    if (!detected) {
      throw new ValidationError("file", "The file isn't a JPEG, PNG, WebP or AVIF image.");
    }

    // Store under the verified type so the stored bytes and content type can't disagree.
    // The stored name is random (the storage adapter mints it); the client's file
    // name is never used on disk.
    return this.imageStorage.upload({ ...input, contentType: detected });
  }
}
