import { NextResponse } from "next/server";

import { RevokeSession } from "@/src/domain/use-cases/sessions/SessionCommands";
import { GetTeamMember } from "@/src/domain/use-cases/team/GetTeamMember";
import { sessionRepository, userRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getOwnerSession } from "@/src/lib/require-admin";
import { isBreakGlassAdmin } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; sessionId: string }> };

/**
 * DELETE /api/admin/team/:id/sessions/:sessionId — sign one of a team member's
 * browsers out. Owner only; recorded under the team's access. 404 when it isn't
 * one of their active sessions.
 */
export async function DELETE(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const session = await getOwnerSession();
  if (!session) return unauthorizedResponse();
  const { id, sessionId } = await params;

  try {
    await new GetTeamMember(userRepository).execute(id, isBreakGlassAdmin(id));
    await new RevokeSession(sessionRepository, userRepository).execute(
      { userId: id, actor: { id: session.user.id, name: session.user.name ?? session.user.id } },
      sessionId,
    );
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponseFromException(error, `DELETE /api/admin/team/${id}/sessions/${sessionId} failed`);
  }
}
