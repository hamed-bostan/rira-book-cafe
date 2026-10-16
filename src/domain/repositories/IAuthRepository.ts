/**
 * What a successful OTP verification yields: the caller's authenticated identity.
 * Deliberately *not* the full `User` entity — OTP only proves ownership of a
 * phone; the persisted profile (email, avatar, completed name) is assembled
 * elsewhere (see `GetOrCreateUser`). Keeping these separate stops the auth
 * adapters from having to fabricate profile fields they know nothing about.
 */
export type AuthIdentity = {
  /** Stable identifier — the normalized phone digits. */
  id: string;
  /** The phone the user verified (display form). */
  phone: string;
  /** A display name to seed a brand-new user with (a placeholder for OTP sign-in). */
  name: string;
}

export type IAuthRepository = {
  /** Generate and deliver a one-time code for the phone. Returns false if the phone is invalid. */
  requestOtp(phone: string): Promise<boolean>;
  /** Verify the code; returns the authenticated identity on success, otherwise `null`. */
  verifyOtp(phone: string, code: string): Promise<AuthIdentity | null>;
  /**
   * Read back the currently stored code for a phone so it can be shown in the UI.
   * Optional: implement it to surface the code (mock, or a demo build), omit it
   * to keep the code secret. Exposing a real SMS code to the client defeats OTP
   * security, so only implement this where that trade-off is acceptable.
   */
  peekDevOtp?(phone: string): string | undefined;
}
