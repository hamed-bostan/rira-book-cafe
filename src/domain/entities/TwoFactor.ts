/**
 * Optional authenticator-app two-factor for dashboard users (TOTP, RFC 6238).
 *
 * Sign-in stays the phone code for everyone. A dashboard user who has set up an
 * authenticator app is then asked for its six digits before the dashboard opens
 * in that browser; the storefront never asks, so guest sign-in is untouched.
 */

/** Digits in a code — what every authenticator app shows by default. */
export const TOTP_DIGITS = 6;

/** Seconds per code. */
export const TOTP_PERIOD_SECONDS = 30;

/**
 * Codes accepted either side of now, in periods: one each way covers a phone clock
 * that's half a minute out and a code typed as it rolled over, which is the
 * allowance RFC 6238 §5.2 recommends.
 */
export const TOTP_WINDOW = 1;

/** Recovery codes issued at enrolment, each usable once. */
export const RECOVERY_CODE_COUNT = 10;

/**
 * The issuer an authenticator app files the account under. Latin on purpose: it
 * goes into the `otpauth://` label, which some apps show without bidi support.
 */
export const TWO_FACTOR_ISSUER = "Rira Book Cafe";

/** What the user has set up. `pending` is a secret shown but not yet confirmed with a code. */
export type TwoFactorState = "off" | "pending" | "on";

/** A user's two-factor record as stored. The secret stays sealed until it's needed. */
export type TwoFactorRecord = {
  userId: string;
  /** The TOTP secret, encrypted (see `ITwoFactorCrypto.seal`). */
  sealedSecret: string;
  /** Null while enrolment waits for its first code. */
  enabledAt: Date | null;
  /** The last time step a code was accepted for, so a code can't be used twice. */
  lastUsedStep: number | null;
  /** SHA-256 hashes of the recovery codes not yet used. */
  recoveryCodeHashes: string[];
};

/** What the security screens show about a user's two-factor. */
export type TwoFactorStatus = {
  state: TwoFactorState;
  enabledAt: Date | null;
  recoveryCodesLeft: number;
};

export function twoFactorStatus(record: TwoFactorRecord | null): TwoFactorStatus {
  if (!record) return { state: "off", enabledAt: null, recoveryCodesLeft: 0 };
  return {
    state: record.enabledAt ? "on" : "pending",
    enabledAt: record.enabledAt,
    recoveryCodesLeft: record.enabledAt ? record.recoveryCodeHashes.length : 0,
  };
}

/** A typed code with spaces and separators taken out ("123 456" → "123456"); null if it isn't six digits. */
export function normalizeTotpCode(input: string): string | null {
  const digits = toLatinDigits(input).replace(/[\s-]/g, "");
  return new RegExp(`^\\d{${TOTP_DIGITS}}$`).test(digits) ? digits : null;
}

/** A recovery code as typed, made comparable: case and separators don't matter. */
export function normalizeRecoveryCode(input: string): string | null {
  const compact = toLatinDigits(input).replace(/[\s-]/g, "").toUpperCase();
  return /^[A-Z2-7]{16}$/.test(compact) ? compact : null;
}

/** Persian and Arabic-Indic digits as ASCII, so a code typed on a Persian keyboard still counts. */
function toLatinDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

/**
 * Where a signed-in dashboard user stands with the second factor in *this* browser.
 *
 * - `ok` — nothing more to ask (not needed, or already passed here).
 * - `verify` — they use an authenticator app and haven't entered a code here yet.
 * - `enroll` — the owner requires two-factor and they haven't set it up.
 */
export type SecondFactorGate = "ok" | "verify" | "enroll";

export function secondFactorGate(input: {
  state: TwoFactorState;
  requiredByOwner: boolean;
  /** Whether the server can encrypt secrets at all (an encryption key is configured). */
  available: boolean;
  verifiedInThisSession: boolean;
}): SecondFactorGate {
  if (input.verifiedInThisSession) return "ok";
  // Someone already enrolled is asked whether or not the key is configured: without
  // it the app can't check their codes, but a recovery code still works — and
  // failing open would let an outage of one env var switch off their second factor.
  if (input.state === "on") return "verify";
  if (input.requiredByOwner && input.available) return "enroll";
  return "ok";
}
