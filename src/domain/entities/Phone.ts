/** Shortest string of digits accepted as a phone number. */
export const MIN_PHONE_DIGITS = 8;

/**
 * Reduce a typed phone number to its canonical digits. This is a domain rule, not
 * an SMS-provider detail: a user's id *is* their normalized phone, so every path
 * that derives an id from a number — OTP sign-in, granting an admin role — must
 * agree on this function, or the same person gets two identities.
 *
 * Iranian numbers reaching us as `+98…`/`98…` are rewritten to the local `0…`
 * form; anything else keeps its digits as typed.
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("98") && digits.length === 12) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

/** True when `phone` carries enough digits to plausibly identify a subscriber. */
export function isPlausiblePhone(phone: string): boolean {
  return normalizePhone(phone).length >= MIN_PHONE_DIGITS;
}
