import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import QRCode from "qrcode";

import { TOTP_DIGITS, TOTP_PERIOD_SECONDS, TOTP_WINDOW, TWO_FACTOR_ISSUER } from "@/src/domain/entities/TwoFactor";
import type { ITwoFactorCrypto } from "@/src/domain/repositories/ITwoFactorCrypto";

import { base32Decode, base32Encode, matchTotp } from "./totp";

/** Bytes of a TOTP secret: 160 bits, the HMAC-SHA1 key length RFC 4226 recommends. */
const SECRET_BYTES = 20;
/** Bytes of a recovery code: 80 bits, 16 base32 characters. */
const RECOVERY_CODE_BYTES = 10;
/** A sealed secret's format version, so the scheme can change without guessing at old rows. */
const SEAL_VERSION = "v1";
const KEY_BYTES = 32;

/**
 * Parse the encryption key from the environment: 32 bytes as 64 hex characters or
 * as base64. `null` when unset or malformed (the env check reports a malformed one
 * at boot; this only refuses to use it).
 */
export function parseTwoFactorKey(value: string | undefined): Buffer | null {
  if (!value) return null;
  const trimmed = value.trim();
  const key = /^[0-9a-fA-F]{64}$/.test(trimmed) ? Buffer.from(trimmed, "hex") : Buffer.from(trimmed, "base64");
  return key.length === KEY_BYTES ? key : null;
}

/**
 * Two-factor cryptography on Node's own `crypto`:
 *
 * - secrets are sealed with AES-256-GCM under `TWO_FACTOR_ENCRYPTION_KEY`, a fresh
 *   96-bit IV each time — authenticated, so a tampered row fails to open rather
 *   than yielding a different secret;
 * - codes are TOTP per RFC 6238 (see `totp.ts`);
 * - recovery codes are 80 random bits and stored as plain SHA-256. A slow hash buys
 *   nothing at that entropy (2^80 guesses is out of reach either way), and a fast
 *   one lets a recovery code be checked without a per-code salt lookup.
 *
 * Without a key, `available` is false and sealing/opening throw; hashing still
 * works, so a recovery code still gets an enrolled user in.
 */
export class TotpTwoFactorCrypto implements ITwoFactorCrypto {
  readonly available: boolean;

  constructor(private readonly key: Buffer | null) {
    this.available = key !== null;
  }

  newSecret(): string {
    return base32Encode(randomBytes(SECRET_BYTES));
  }

  seal(secret: string): string {
    const key = this.requireKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [SEAL_VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(
      ":",
    );
  }

  open(sealed: string): string {
    const key = this.requireKey();
    const [version, iv, tag, ciphertext] = sealed.split(":");
    if (version !== SEAL_VERSION || !iv || !tag || !ciphertext) throw new Error("Unrecognised sealed secret.");
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
  }

  otpauthUri(secret: string, accountName: string): string {
    const label = `${encodeURIComponent(TWO_FACTOR_ISSUER)}:${encodeURIComponent(accountName)}`;
    const params = new URLSearchParams({
      secret,
      issuer: TWO_FACTOR_ISSUER,
      algorithm: "SHA1",
      digits: String(TOTP_DIGITS),
      period: String(TOTP_PERIOD_SECONDS),
    });
    return `otpauth://totp/${label}?${params.toString()}`;
  }

  qrCode(uri: string): Promise<string> {
    return QRCode.toDataURL(uri, { errorCorrectionLevel: "M", margin: 2, width: 240 });
  }

  matchCode(secret: string, code: string, now: Date): number | null {
    return matchTotp(base32Decode(secret), code, now, {
      digits: TOTP_DIGITS,
      periodSeconds: TOTP_PERIOD_SECONDS,
      window: TOTP_WINDOW,
    });
  }

  newRecoveryCodes(count: number): string[] {
    return Array.from({ length: count }, () => {
      const compact = base32Encode(randomBytes(RECOVERY_CODE_BYTES));
      return compact.match(/.{4}/g)?.join("-") ?? compact;
    });
  }

  hashRecoveryCode(normalized: string): string {
    return createHash("sha256").update(normalized).digest("hex");
  }

  private requireKey(): Buffer {
    if (!this.key) throw new Error("Two-factor encryption key is not configured.");
    return this.key;
  }
}
