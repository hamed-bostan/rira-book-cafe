/**
 * Sniff an image's true MIME type from its leading "magic" bytes, ignoring any
 * client-supplied content type (which is trivially spoofable). Returns the
 * canonical type for the formats we accept, or `null` when the bytes don't match
 * a supported image — so a non-image (HTML/SVG/script) can't be stored and then
 * served from a public bucket under an image content type. Pure — no I/O.
 */
export type DetectedImageType = "image/jpeg" | "image/png" | "image/webp" | "image/avif";

export function detectImageType(data: ArrayBuffer | Uint8Array): DetectedImageType | null {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);

  if (isJpeg(bytes)) return "image/jpeg";
  if (isPng(bytes)) return "image/png";
  if (isWebp(bytes)) return "image/webp";
  if (isAvif(bytes)) return "image/avif";
  return null;
}

/** FF D8 FF — Start-of-Image marker shared by every JPEG variant. */
function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/** 89 50 4E 47 0D 0A 1A 0A — the fixed 8-byte PNG signature. */
function isPng(bytes: Uint8Array): boolean {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < sig.length) return false;
  return sig.every((b, i) => bytes[i] === b);
}

/** RIFF container with a "WEBP" form type at offset 8. */
function isWebp(bytes: Uint8Array): boolean {
  return ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP";
}

/**
 * ISO-BMFF `ftyp` box (offset 4) whose major or compatible brand is `avif`/`avis`.
 * Scanning the compatible-brand list catches files written with a `mif1` major
 * brand, which some encoders emit.
 */
function isAvif(bytes: Uint8Array): boolean {
  if (ascii(bytes, 4, 4) !== "ftyp") return false;

  const boxSize = readUint32BE(bytes, 0);
  const end = Math.min(boxSize > 0 ? boxSize : bytes.length, bytes.length);
  // Major brand at 8; offset 12 is the 4-byte minor_version; compatible brands follow.
  for (let offset = 8; offset + 4 <= end; offset += 4) {
    if (offset === 12) continue;
    const brand = ascii(bytes, offset, 4);
    if (brand === "avif" || brand === "avis") return true;
  }
  return false;
}

/** Read `length` bytes as a Latin-1 string, or "" if they run past the buffer. */
function ascii(bytes: Uint8Array, offset: number, length: number): string {
  if (offset < 0 || offset + length > bytes.length) return "";
  let out = "";
  for (let i = 0; i < length; i += 1) out += String.fromCharCode(bytes[offset + i]);
  return out;
}

/** Big-endian uint32, or 0 if it runs past the buffer. */
function readUint32BE(bytes: Uint8Array, offset: number): number {
  if (offset + 4 > bytes.length) return 0;
  return (
    ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
  );
}
