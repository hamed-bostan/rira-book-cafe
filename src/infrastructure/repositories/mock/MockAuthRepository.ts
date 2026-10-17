import type { AuthIdentity, IAuthRepository } from "@/src/domain/repositories/IAuthRepository";
import type { ILogger } from "@/src/domain/repositories/ILogger";

import { normalizePhone } from "../../sms/smsIrClient";
import { getOtpStore } from "../otpStore";

const MIN_PHONE_DIGITS = 8;

/**
 * Demo OTP auth. Generates a random 4-digit code per phone, keeps it in memory,
 * and logs it to the server console (stands in for SMS). Codes are single-use.
 *
 * Mock-only: the in-memory store works in dev (one process) but NOT in serverless
 * prod — swap for an external store (Redis/DB) with expiry + rate limiting and a
 * real SMS provider when wiring this for real.
 */
export class MockAuthRepository implements IAuthRepository {
  // Shared across module re-evaluations so a code stored on `/login` is still
  // there when `/login/verify` reads it. See getOtpStore.
  private readonly codes = getOtpStore<string>("mock-auth");

  constructor(private readonly logger: ILogger) {}

  async requestOtp(phone: string): Promise<boolean> {
    const mobile = normalizePhone(phone);
    if (mobile.length < MIN_PHONE_DIGITS) {
      return false;
    }

    const code = String(Math.floor(1000 + Math.random() * 9000));
    this.codes.set(mobile, code);
    // A dev stand-in for the SMS: the message carries the code, not a field, so
    // phone/OTP redaction leaves it readable in the terminal.
    this.logger.info(`[dev] OTP for ${mobile}: ${code}`);
    return true;
  }

  async verifyOtp(phone: string, code: string): Promise<AuthIdentity | null> {
    const mobile = normalizePhone(phone);
    if (this.codes.get(mobile) !== code) {
      return null;
    }

    this.codes.delete(mobile); // one-time use
    // `id` is the normalised phone so the minted user id is provider-independent
    // (matches what SmsIrAuthRepository would mint, and the ADMIN_USER_IDS
    // allowlist) regardless of how the number was typed (+98…, 98…, 09…).
    return { id: mobile, phone, name: "Rira Guest" };
  }

  /** Dev/mock only: surface the stored code so the UI can display it (no SMS yet). */
  peekDevOtp(phone: string): string | undefined {
    return this.codes.get(normalizePhone(phone));
  }
}
