import { detectImageType, type DetectedImageType } from "./detectImageType";

/**
 * Sniff a receipt's true type from its leading bytes: any image the other folders
 * take, or the PDF a supplier sent. PDFs are a receipt-only type, since receipts are
 * the one private folder (see `app/uploads/[...path]/route.ts`). Pure — no I/O.
 */
export type DetectedReceiptType = DetectedImageType | "application/pdf";

export function detectReceiptType(data: ArrayBuffer | Uint8Array): DetectedReceiptType | null {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  return detectImageType(bytes) ?? (isPdf(bytes) ? "application/pdf" : null);
}

/**
 * `%PDF-` as the very first bytes. Readers tolerate a header further in, but a file
 * that starts with anything else is refused rather than searched.
 */
function isPdf(bytes: Uint8Array): boolean {
  const sig = [0x25, 0x50, 0x44, 0x46, 0x2d];
  if (bytes.length < sig.length) return false;
  return sig.every((b, i) => bytes[i] === b);
}
