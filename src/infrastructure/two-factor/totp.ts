import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * TOTP (RFC 6238) over HOTP (RFC 4226), HMAC-SHA1 — the combination every
 * authenticator app supports by default. Small enough to own outright rather than
 * take a dependency for, and pinned by the RFCs' own test vectors (see the tests).
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** RFC 4648 base32, no padding — the form `otpauth://` secrets take. */
export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

/** Decode base32 (case-insensitive, padding and spaces ignored). Throws on a character outside the alphabet. */
export function base32Decode(input: string): Buffer {
  const clean = input.replace(/[\s=]/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error("Invalid base32 character.");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** HOTP (RFC 4226 §5.3): the `digits`-long code for one counter value. */
export function hotp(key: Uint8Array, counter: number, digits: number): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(message).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, "0");
}

/** The TOTP time step for an instant (RFC 6238 §4.2, T0 = 0). */
export function timeStep(now: Date, periodSeconds: number): number {
  return Math.floor(now.getTime() / 1000 / periodSeconds);
}

/**
 * The step within `window` steps of now whose code is `code`, or `null`.
 * Compared in constant time per candidate, so the time a wrong guess takes says
 * nothing about how close it was.
 */
export function matchTotp(
  key: Uint8Array,
  code: string,
  now: Date,
  options: { digits: number; periodSeconds: number; window: number },
): number | null {
  if (code.length !== options.digits) return null;
  const given = Buffer.from(code);
  const current = timeStep(now, options.periodSeconds);
  let matched: number | null = null;
  // Every candidate is computed and compared, matched or not, for the same reason.
  for (let offset = -options.window; offset <= options.window; offset += 1) {
    const step = current + offset;
    if (step < 0) continue;
    const expected = Buffer.from(hotp(key, step, options.digits));
    if (timingSafeEqual(expected, given) && matched === null) matched = step;
  }
  return matched;
}
