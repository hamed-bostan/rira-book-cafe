import { NextResponse, type NextRequest } from "next/server";

import { secondFactorSchema } from "@/src/contracts/team-security-schema";
import { VerifySecondFactor } from "@/src/domain/use-cases/two-factor/TwoFactorCommands";
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
 * POST /api/admin/me/two-factor/verify — pass the check in this browser with a
 * code from the app or a recovery code (which is then used up). 204, then the
 * dashboard opens. Rate-limited per account and per IP: six digits fall to
 * guessing otherwise.
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
  const parsed = secondFactorSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    await new VerifySecondFactor({
      twoFactor: twoFactorRepository,
      crypto: twoFactorCrypto,
      sessions: sessionRepository,
    }).execute(session.user.id, sessionId, parsed.data);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/admin/me/two-factor/verify failed");
  }
}
