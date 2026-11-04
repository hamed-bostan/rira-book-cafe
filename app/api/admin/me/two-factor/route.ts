import { NextResponse } from "next/server";

import { GetTwoFactorOverview } from "@/src/domain/use-cases/two-factor/TwoFactorCommands";
import { teamSettingsRepository, twoFactorCrypto, twoFactorRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getDashboardSessionAtDoor } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/me/two-factor — your authenticator-app two-factor: off, waiting
 * for its first code, or on (with recovery codes left); whether the server can do
 * it at all; and whether the owner requires it. Answers a dashboard user whose
 * browser hasn't passed the check yet too — the check screen reads it.
 */
export async function GET(): Promise<NextResponse> {
  const door = await getDashboardSessionAtDoor();
  if (!door) return unauthorizedResponse();
  try {
    const overview = await new GetTwoFactorOverview({
      twoFactor: twoFactorRepository,
      crypto: twoFactorCrypto,
      settings: teamSettingsRepository,
    }).execute(door.session.user.id);
    return NextResponse.json({
      ...overview,
      enabledAt: overview.enabledAt?.toISOString() ?? null,
      gate: door.gate,
    });
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/me/two-factor failed");
  }
}
