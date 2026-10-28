/** Shortest string of digits accepted as a phone number. */
export const MIN_PHONE_DIGITS = 8;

/** Digits in a complete Iranian mobile in its local form, `09…`. */
const MOBILE_DIGITS = 11;

/** A foreign number's digits, country code included (E.164 allows at most 15). */
const MIN_FOREIGN_PHONE_DIGITS = 8;
const MAX_FOREIGN_PHONE_DIGITS = 15;

/** Iran's country calling code, which `normalizePhone` rewrites to the local `0`. */
const IRAN_CALLING_CODE = "98";

/** A complete Iranian mobile after normalizing: `09` and nine more digits. */
const IRAN_MOBILE = /^09\d{9}$/;

/** A foreign number's digits: a country code never starts with 0. */
const FOREIGN_DIGITS = new RegExp(`^[1-9]\\d{${MIN_FOREIGN_PHONE_DIGITS - 1},${MAX_FOREIGN_PHONE_DIGITS - 1}}$`);

/**
 * How a number may be typed for the team: an optional leading `+`, then a digit,
 * then digits, spaces, dashes and brackets — no letters, no leading separator.
 * Checked after Persian and Arabic digits are folded to ASCII.
 */
const TEAM_PHONE_SHAPE = /^\+?\s*\d[\d\s()-]*$/;

/** Persian (۰–۹) and Arabic-Indic (٠–٩) digits — what a phone keyboard in the fa locale types. */
const PERSIAN_DIGITS = /[۰-۹]/g;
const ARABIC_DIGITS = /[٠-٩]/g;

/** `phone` with Persian and Arabic-Indic digits folded to ASCII; everything else as typed. */
function foldDigits(phone: string): string {
  return phone
    .replace(PERSIAN_DIGITS, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(ARABIC_DIGITS, (digit) => String(digit.charCodeAt(0) - 0x0660));
}

/**
 * The digits of a typed number, in whichever script they were typed, and nothing
 * else — before any rewriting of the country code.
 */
export function phoneDigits(phone: string): string {
  return foldDigits(phone).replace(/\D/g, "");
}

/**
 * Reduce a typed phone number to its canonical digits. This is a domain rule, not
 * an SMS-provider detail: a user's id *is* their normalized phone, so every path
 * that derives an id from a number — OTP sign-in, granting an admin role — must
 * agree on this function, or the same person gets two identities.
 *
 * Iranian numbers reaching us as `+98…`/`98…` are rewritten to the local `0…`
 * form; anything else keeps its digits as typed. Persian and Arabic-Indic digits
 * count as the digits they are. An id is already canonical, so it comes back
 * unchanged.
 */
export function normalizePhone(phone: string): string {
  const digits = phoneDigits(phone);
  if (digits.startsWith(IRAN_CALLING_CODE) && digits.length === 12) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

/** True when `phone` carries enough digits to plausibly identify a subscriber. */
export function isPlausiblePhone(phone: string): boolean {
  return normalizePhone(phone).length >= MIN_PHONE_DIGITS;
}

/**
 * True when `phone` is a number dashboard access can be granted to — stricter than
 * {@link isPlausiblePhone}, because the number is someone's sign-in and a landline
 * or a digit short can never receive the code:
 * - an Iranian mobile, typed however (`0912…`, `+98 912…`, `98-912-…`), that
 *   normalizes to a complete `09…` number of 11 digits;
 * - or a foreign number, typed with a leading `+` (and not `+98`), of 8 to 15 digits.
 */
export function isTeamPhone(phone: string): boolean {
  const typed = foldDigits(phone).trim();
  if (!TEAM_PHONE_SHAPE.test(typed)) return false;
  if (IRAN_MOBILE.test(normalizePhone(typed))) return true;
  const digits = phoneDigits(typed);
  return typed.startsWith("+") && !digits.startsWith(IRAN_CALLING_CODE) && FOREIGN_DIGITS.test(digits);
}

/**
 * How many digits a number for the team has once it's all typed, in the form it's
 * being typed: 11 for `0912…`, 12 for `+98 912…`/`98 912…`, and the most a foreign
 * `+…` number may have. Lets a form tell a number still being typed from a wrong
 * one, so it doesn't call `+98 912 345 678` wrong one digit short of done.
 */
export function teamPhoneDigitsWhenComplete(phone: string): number {
  const typed = foldDigits(phone).trim();
  if (phoneDigits(typed).startsWith(IRAN_CALLING_CODE)) return IRAN_CALLING_CODE.length + MOBILE_DIGITS - 1;
  if (typed.startsWith("+")) return MAX_FOREIGN_PHONE_DIGITS;
  return MOBILE_DIGITS;
}
