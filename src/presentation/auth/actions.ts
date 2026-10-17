"use server";

import { headers } from "next/headers";
import { AuthError } from "next-auth";

import { signIn, signOut } from "@/auth";
import { normalizePhone } from "@/src/domain/entities/Phone";
import { RequestOtp } from "@/src/domain/use-cases/auth/RequestOtp";
import { authRepository } from "@/src/infrastructure/container";
import { checkRateLimit, RATE_LIMITS, requestIp, type RateLimitPolicy } from "@/src/lib/api/rate-limit";

const TOO_MANY_ATTEMPTS = "Too many attempts. Please wait a few minutes and try again.";

/**
 * Count a sign-in attempt per caller IP and per phone; true when it's over the
 * limit. Per phone so a code can't be brute-forced (or a number SMS-bombed) by
 * spreading attempts across addresses.
 */
async function isRateLimited(policy: RateLimitPolicy, phone: string): Promise<boolean> {
  const decision = await checkRateLimit(policy, {
    ip: requestIp(await headers()),
    subject: normalizePhone(phone) || null,
  });
  return !decision.allowed;
}

/** Sends a one-time code to the phone. */
export async function requestOtp(phone: string) {
  if (await isRateLimited(RATE_LIMITS.otpRequest, phone)) return { error: TOO_MANY_ATTEMPTS };

  const sent = await new RequestOtp(authRepository).execute(phone);
  // `false` covers both an invalid number and an SMS-provider failure.
  return sent ? { ok: true as const } : { error: "Couldn't send the code. Check the number and try again." };
}

/**
 * Dev/mock only: returns the code currently stored for the phone so the UI can
 * show it while there's no SMS provider. Gated on the repository, not the build
 * mode: only the mock implements `peekDevOtp`, so this surfaces the code whenever
 * the mock is active (no SMS provider configured) — including local production
 * builds — and returns `null` once a real SMS provider is wired up.
 */
export async function peekDevOtp(phone: string): Promise<string | null> {
  return authRepository.peekDevOtp?.(phone) ?? null;
}

/**
 * Verifies the code via NextAuth. On success `signIn` throws a redirect (to the
 * callbackUrl) which must propagate; a wrong code returns an error for the form.
 */
export async function verifyOtp(input: { phone: string; code: string; callbackUrl?: string }) {
  // Only allow relative same-origin paths (guards against open-redirect).
  const target = input.callbackUrl;
  const redirectTo = target && target.startsWith("/") && !target.startsWith("//") ? target : "/";

  if (await isRateLimited(RATE_LIMITS.otpVerify, input.phone)) {
    return { error: TOO_MANY_ATTEMPTS, rateLimited: true };
  }

  try {
    await signIn("credentials", { phone: input.phone, code: input.code, redirectTo });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Incorrect code. Please try again." };
    }
    throw error;
  }
}

/**
 * Clears the session and returns to the start. `signOut` throws a redirect that
 * must propagate, so don't wrap it in a swallowing try/catch.
 */
export async function logout() {
  await signOut({ redirectTo: "/" });
}
