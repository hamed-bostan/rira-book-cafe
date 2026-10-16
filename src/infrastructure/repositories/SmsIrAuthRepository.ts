import type { AuthIdentity, IAuthRepository } from "@/src/domain/repositories/IAuthRepository";

import { normalizePhone, sendPatternSms } from "../sms/smsIrClient";

import { getOtpStore } from "./otpStore";

const MIN_PHONE_DIGITS = 8;
// Short window so a leaked/stale SMS can't be replayed long after the fact.
const CODE_TTL_MS = 2 * 60 * 1000;

export type SmsIrConfig = {
  /** Panel API key, sent as the `x-api-key` header. */
  apiKey: string;
  /** Approved "verify" template whose body contains the `#CODE#` parameter. */
  templateId: number;
  /** Override the API host (defaults to the public SMS.ir endpoint). */
  baseUrl?: string;
}

type StoredCode = {
  code: string;
  expiresAt: number;
};

/**
 * Real OTP auth backed by SMS.ir's "verify" SMS template.
 *
 * We generate the code, hand it to SMS.ir for delivery, and keep it (with a
 * short TTL) to check against what the user types — SMS.ir only sends the
 * message; matching the code is ours to do. For this demo build it also exposes
 * the code via `peekDevOtp` so the verify screen can show it (see the warning
 * on that method — drop it when the code must stay secret).
 *
 * The code store is in-memory: fine for a single long-running server
 * (`next start`), but NOT for multi-instance/serverless deploys — move it to a
 * shared store (Redis/DB) with the same TTL there.
 */
export class SmsIrAuthRepository implements IAuthRepository {
  // Shared across module re-evaluations so a code stored on `/login` is still
  // there when `/login/verify` reads it. See getOtpStore.
  private readonly codes = getOtpStore<StoredCode>("sms-ir");
  private readonly config: SmsIrConfig;

  constructor(config: SmsIrConfig) {
    this.config = config;
  }

  async requestOtp(phone: string): Promise<boolean> {
    const mobile = normalizePhone(phone);
    if (mobile.length < MIN_PHONE_DIGITS) {
      return false;
    }

    const code = String(Math.floor(1000 + Math.random() * 9000));

    const sent = await sendPatternSms(this.config, mobile, this.config.templateId, [
      { name: "CODE", value: code },
    ]);
    if (!sent) {
      return false;
    }

    this.codes.set(mobile, { code, expiresAt: Date.now() + CODE_TTL_MS });
    return true;
  }

  /**
   * Surfaces the stored code so the verify screen can display it, in dev and in
   * production builds alike. NOTE: exposing the SMS code to the client defeats
   * the security of OTP verification — enabled by request for a demo/testing
   * build. Remove this method for any deployment where the code must stay secret.
   */
  peekDevOtp(phone: string): string | undefined {
    const entry = this.codes.get(normalizePhone(phone));
    if (!entry || entry.expiresAt < Date.now()) {
      return undefined;
    }
    return entry.code;
  }

  async verifyOtp(phone: string, code: string): Promise<AuthIdentity | null> {
    const mobile = normalizePhone(phone);
    const entry = this.codes.get(mobile);

    if (!entry) {
      return null;
    }

    if (entry.expiresAt < Date.now()) {
      this.codes.delete(mobile); // expired — drop it
      return null;
    }

    if (entry.code !== code) {
      return null; // wrong code — keep the entry so the user can retry
    }

    this.codes.delete(mobile); // correct, and one-time use
    return { id: mobile, phone, name: "Rira Guest" };
  }
}
