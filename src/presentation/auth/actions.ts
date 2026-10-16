"use server";

import { AuthError } from "next-auth";

import { signIn, signOut } from "@/auth";
import { RequestOtp } from "@/src/domain/use-cases/auth/RequestOtp";
import { authRepository } from "@/src/infrastructure/container";

/** Sends a one-time code to the phone. */
export async function requestOtp(phone: string) {
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
