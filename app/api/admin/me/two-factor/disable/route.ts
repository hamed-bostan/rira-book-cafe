import { NextResponse, type NextRequest } from "next/server";

import { secondFactorSchema } from "@/src/contracts/team-security-schema";
import { DisableTwoFactor } from "@/src/domain/use-cases/two-factor/TwoFactorCommands";
import { teamSettingsRepository, twoFactorCrypto, twoFactorRepository } from "@/src/infrastructure/container";
import { enforceRateLimit, RATE_LIMITS } from "@/src/lib/api/rate-limit";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/me/two-factor/disable — turn your two-factor off, proving it with
 * a current code or a recovery code. Needs a browser that already passed the check.
 * 409 `TWO_FACTOR_REQUIRED` while the owner requires it. Recorded.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("dashboard.view");
  if (!session) return unauthorizedResponse();

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
    await new DisableTwoFactor({
      twoFactor: twoFactorRepository,
      crypto: twoFactorCrypto,
      settings: teamSettingsRepository,
    }).execute(session.user.id, parsed.data, { id: session.user.id, name: session.user.name ?? session.user.id });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/admin/me/two-factor/disable failed");
  }
}
