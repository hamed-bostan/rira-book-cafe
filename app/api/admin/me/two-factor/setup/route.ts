import { NextResponse, type NextRequest } from "next/server";

import { StartTwoFactorSetup } from "@/src/domain/use-cases/two-factor/TwoFactorCommands";
import { twoFactorCrypto, twoFactorRepository, userRepository } from "@/src/infrastructure/container";
import { enforceRateLimit, RATE_LIMITS } from "@/src/lib/api/rate-limit";
import { errorResponse, errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getDashboardSessionAtDoor } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/me/two-factor/setup — start setting up an authenticator app: a
 * new secret, as a QR code and as a key to type. Nothing is on until the first
 * code confirms it (`/enable`). Allowed before the browser has passed the check —
 * that's how someone the owner requires it of sets it up — but never over an app
 * that's already on (409 `TWO_FACTOR_ALREADY_ON`): replacing a second factor takes
 * the second factor. Never cached: the secret is in the body.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const door = await getDashboardSessionAtDoor();
  if (!door) return unauthorizedResponse();
  if (door.gate === "verify") {
    return errorResponse(409, { message: "Two-factor is already on.", code: "TWO_FACTOR_ALREADY_ON" });
  }

  const limited = await enforceRateLimit(request, RATE_LIMITS.twoFactorVerify, door.session.user.id);
  if (limited) return limited;

  try {
    const user = await userRepository.getById(door.session.user.id);
    const setup = await new StartTwoFactorSetup({ twoFactor: twoFactorRepository, crypto: twoFactorCrypto }).execute(
      door.session.user.id,
      user?.phone ?? door.session.user.id,
    );
    return NextResponse.json(setup, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/admin/me/two-factor/setup failed");
  }
}
