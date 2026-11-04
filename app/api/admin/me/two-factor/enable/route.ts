import { NextResponse, type NextRequest } from "next/server";

import { twoFactorCodeSchema } from "@/src/contracts/team-security-schema";
import { ConfirmTwoFactorSetup } from "@/src/domain/use-cases/two-factor/TwoFactorCommands";
import { sessionRepository, twoFactorCrypto, twoFactorRepository } from "@/src/infrastructure/container";
import { enforceRateLimit, RATE_LIMITS } from "@/src/lib/api/rate-limit";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getDashboardSessionAtDoor } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/me/two-factor/enable — confirm the app with its first code and
 * turn two-factor on. Answers the ten recovery codes, once: only their hashes are
 * kept. This browser counts as verified. Rate-limited per account.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const door = await getDashboardSessionAtDoor();
  const sessionId = door?.session.sessionId;
  if (!door || !sessionId) return unauthorizedResponse();
  const { session } = door;

  const limited = await enforceRateLimit(request, RATE_LIMITS.twoFactorVerify, session.user.id);
  if (limited) return limited;

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = twoFactorCodeSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const recoveryCodes = await new ConfirmTwoFactorSetup({
      twoFactor: twoFactorRepository,
      crypto: twoFactorCrypto,
      sessions: sessionRepository,
    }).execute(session.user.id, sessionId, parsed.data.code, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json({ recoveryCodes }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/admin/me/two-factor/enable failed");
  }
}
