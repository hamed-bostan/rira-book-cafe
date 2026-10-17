import type { RateLimitDecision, RateLimitRule } from "@/src/domain/repositories/IRateLimiter";
import { rateLimiter } from "@/src/infrastructure/container";
import { clientIp } from "@/src/lib/security/client-ip";

import { tooManyRequestsResponse } from "./responses";

import type { NextResponse } from "next/server";

/**
 * Rate-limit policies for the endpoints worth abusing: the ones that cost money
 * (SMS, email), guard a secret (the OTP), or write to disk and stock.
 *
 * Every policy limits per IP, and optionally per *subject* — the signed-in user,
 * or the phone a code is for — so neither rotating IPs nor rotating accounts gets
 * around it. The per-IP numbers are generous on purpose: guests on the cafe's own
 * Wi-Fi all share one public address.
 */
export type RateLimitPolicy = {
  /** Key namespace, e.g. `otp-verify`. */
  name: string;
  perIp: RateLimitRule;
  perSubject?: RateLimitRule;
};

const MINUTE = 60_000;

export const RATE_LIMITS = {
  /** Sending an SMS code: SMS costs money and can be used to harass a number. */
  otpRequest: {
    name: "otp-request",
    perIp: { limit: 30, windowMs: 15 * MINUTE },
    perSubject: { limit: 3, windowMs: 15 * MINUTE },
  },
  /** Checking a code: 4 digits fall to brute force in seconds without this. */
  otpVerify: {
    name: "otp-verify",
    perIp: { limit: 60, windowMs: 15 * MINUTE },
    perSubject: { limit: 10, windowMs: 15 * MINUTE },
  },
  orderPlacement: {
    name: "order-placement",
    perIp: { limit: 100, windowMs: 10 * MINUTE },
    perSubject: { limit: 10, windowMs: 10 * MINUTE },
  },
  /** Opening an online payment — each one is a call to the payment gateway. */
  paymentStart: {
    name: "payment-start",
    perIp: { limit: 100, windowMs: 10 * MINUTE },
    perSubject: { limit: 10, windowMs: 10 * MINUTE },
  },
  imageUpload: {
    name: "image-upload",
    perIp: { limit: 60, windowMs: 10 * MINUTE },
    perSubject: { limit: 30, windowMs: 10 * MINUTE },
  },
  /** Team changes that send invitation / ownership emails and SMS. */
  teamNotice: {
    name: "team-notice",
    perIp: { limit: 30, windowMs: 60 * MINUTE },
    perSubject: { limit: 20, windowMs: 60 * MINUTE },
  },
} as const satisfies Record<string, RateLimitPolicy>;

/**
 * Count one attempt against a policy and return the stricter of the per-IP and
 * per-subject decisions. The subject is counted only if the IP passed, so a
 * blocked IP can't burn down someone else's per-phone allowance.
 */
export async function checkRateLimit(
  policy: RateLimitPolicy,
  identity: { ip: string; subject?: string | null },
): Promise<RateLimitDecision> {
  const byIp = await rateLimiter.consume(`${policy.name}:ip:${identity.ip}`, policy.perIp);
  if (!byIp.allowed || !policy.perSubject || !identity.subject) return byIp;

  return rateLimiter.consume(`${policy.name}:subject:${identity.subject}`, policy.perSubject);
}

/** {@link checkRateLimit} keyed by a request's client IP. */
export function checkRequestRateLimit(
  request: Request,
  policy: RateLimitPolicy,
  subject?: string | null,
): Promise<RateLimitDecision> {
  return checkRateLimit(policy, { ip: clientIp(request.headers), subject });
}

/** Whole seconds for a `Retry-After` header — never 0, which would invite an instant retry. */
export function retryAfterSeconds(decision: RateLimitDecision): number {
  return Math.max(1, Math.ceil(decision.retryAfterMs / 1000));
}

/**
 * Route-handler guard: `null` when the attempt is within the policy, otherwise the
 * 429 response to return as-is.
 */
export async function enforceRateLimit(
  request: Request,
  policy: RateLimitPolicy,
  subject?: string | null,
): Promise<NextResponse | null> {
  const decision = await checkRequestRateLimit(request, policy, subject);
  return decision.allowed ? null : tooManyRequestsResponse(retryAfterSeconds(decision));
}
