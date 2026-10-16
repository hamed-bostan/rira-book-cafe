import { detectImageType } from "../../../lib/detectImageType";

import type {
  IImageStorageRepository,
  StoredImage,
  UploadImageInput,
} from "../../repositories/IImageStorageRepository";

/** Mirrors the bucket's server-side limit (5 MB) so we fail fast and cheaply. */
const MAX_BYTES = 5 * 1024 * 1024;

export class UploadImage {
  constructor(private readonly imageStorage: IImageStorageRepository) {}

  execute(input: UploadImageInput): Promise<StoredImage> {
    const byteLength = input.data.byteLength;
    if (byteLength === 0) {
      throw new Error("UploadImage: image is empty.");
    }
    if (byteLength > MAX_BYTES) {
      throw new Error(`UploadImage: image exceeds the ${MAX_BYTES} byte limit.`);
    }

    // Trust the bytes, not the caller-declared content type (which is spoofable):
    // sniff the real format and reject anything that isn't a supported image.
    const detected = detectImageType(input.data);
    if (!detected) {
      throw new Error("UploadImage: file is not a supported image.");
    }

    // Store under the verified type so the stored bytes and content type can't disagree.
    return this.imageStorage.upload({ ...input, contentType: detected });
  }
}
