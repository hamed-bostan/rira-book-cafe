import { handlers } from "@/auth";
import { normalizePhone } from "@/src/domain/entities/Phone";
import { enforceRateLimit, RATE_LIMITS } from "@/src/lib/api/rate-limit";

import type { NextRequest } from "next/server";

export const { GET } = handlers;

/**
 * Auth.js's POST endpoints (sign-in, sign-out, session update). The credentials
 * callback is where an OTP is checked, so it's rate-limited per IP and per phone
 * like the sign-in server action — a 4-digit code otherwise falls to brute force
 * by posting here directly.
 */
export async function POST(request: NextRequest): Promise<Response> {
  if (request.nextUrl.pathname.endsWith("/callback/credentials")) {
    const limited = await enforceRateLimit(request, RATE_LIMITS.otpVerify, await phoneFrom(request));
    if (limited) return limited;
  }
  return handlers.POST(request);
}

/** The normalized `phone` field of the posted form, or null; reads a clone so Auth.js still gets the body. */
async function phoneFrom(request: NextRequest): Promise<string | null> {
  try {
    const phone = (await request.clone().formData()).get("phone");
    return typeof phone === "string" ? normalizePhone(phone) || null : null;
  } catch {
    return null;
  }
}
