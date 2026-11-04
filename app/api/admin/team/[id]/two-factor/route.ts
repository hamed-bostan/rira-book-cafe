import { NextResponse } from "next/server";

import { GetTeamMember } from "@/src/domain/use-cases/team/GetTeamMember";
import { ResetTwoFactor } from "@/src/domain/use-cases/two-factor/TwoFactorCommands";
import { sessionRepository, twoFactorRepository, userRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getOwnerSession } from "@/src/lib/require-admin";
import { isBreakGlassAdmin } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * DELETE /api/admin/team/:id/two-factor — reset a member's authenticator app (a
 * lost phone) and sign them out everywhere. Owner only; recorded under the team's
 * access. Your own is turned off from your security page instead (409 `REVOKE_SELF`).
 */
export async function DELETE(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const session = await getOwnerSession();
  if (!session) return unauthorizedResponse();
  const { id } = await params;

  try {
    await new GetTeamMember(userRepository).execute(id, isBreakGlassAdmin(id));
    await new ResetTwoFactor({
      twoFactor: twoFactorRepository,
      sessions: sessionRepository,
      users: userRepository,
    }).execute(id, { id: session.user.id, name: session.user.name ?? session.user.id });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponseFromException(error, `DELETE /api/admin/team/${id}/two-factor failed`);
  }
}
