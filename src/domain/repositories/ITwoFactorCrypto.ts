/**
 * The cryptography behind authenticator-app two-factor, kept behind a port so the
 * use-cases stay framework-free and testable with a fake.
 *
 * `available` is false when the server has no encryption key configured: then no
 * secret can be sealed or opened, enrolment is refused, and the UI says so. Hashing
 * and checking recovery codes needs no key, so a user who is already enrolled can
 * still get in with one.
 */
export type ITwoFactorCrypto = {
  readonly available: boolean;
  /** A new random TOTP secret, base32 (what authenticator apps take). */
  newSecret(): string;
  /** Encrypt a secret for storage. Throws when unavailable. */
  seal(secret: string): string;
  /** Decrypt a stored secret. Throws when unavailable or the ciphertext was tampered with. */
  open(sealed: string): string;
  /** The `otpauth://` URI an authenticator app scans. */
  otpauthUri(secret: string, accountName: string): string;
  /** The URI as a QR code image (a `data:` URL). */
  qrCode(uri: string): Promise<string>;
  /** The time step a code matches within the allowed window around `now`, or `null`. */
  matchCode(secret: string, code: string, now: Date): number | null;
  /** Fresh recovery codes, formatted for display ("ABCD-EFGH-…"). */
  newRecoveryCodes(count: number): string[];
  /** A recovery code's storage hash. Takes the normalized form (see `normalizeRecoveryCode`). */
  hashRecoveryCode(normalized: string): string;
};
