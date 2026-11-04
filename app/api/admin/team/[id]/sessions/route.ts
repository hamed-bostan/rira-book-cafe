import { NextResponse } from "next/server";

import { ListSessions, RevokeAllSessions } from "@/src/domain/use-cases/sessions/SessionCommands";
import { GetTeamMember } from "@/src/domain/use-cases/team/GetTeamMember";
import { sessionRepository, userRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { toSessionWire } from "@/src/lib/api/session-wire";
import { getOwnerSession } from "@/src/lib/require-admin";
import { isBreakGlassAdmin } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/team/:id/sessions — where a team member is signed in. Owner only.
 * The owner's own browser is marked when they look at their own row.
 */
export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const session = await getOwnerSession();
  if (!session) return unauthorizedResponse();
  const { id } = await params;

  try {
    await new GetTeamMember(userRepository).execute(id, isBreakGlassAdmin(id));
    const current = id === session.user.id ? (session.sessionId ?? null) : null;
    const sessions = await new ListSessions(sessionRepository).execute(id, current);
    return NextResponse.json(sessions.map(toSessionWire));
  } catch (error) {
    return errorResponseFromException(error, `GET /api/admin/team/${id}/sessions failed`);
  }
}

/**
 * DELETE /api/admin/team/:id/sessions — sign a team member out everywhere. Owner
 * only; recorded under the team's access. On your own row it keeps the browser
 * you're using, as "sign out everywhere else" does on your security page.
 */
export async function DELETE(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const session = await getOwnerSession();
  if (!session) return unauthorizedResponse();
  const { id } = await params;

  try {
    await new GetTeamMember(userRepository).execute(id, isBreakGlassAdmin(id));
    const revoked = await new RevokeAllSessions(sessionRepository, userRepository).execute(
      { userId: id, actor: { id: session.user.id, name: session.user.name ?? session.user.id } },
      id === session.user.id ? session.sessionId : undefined,
    );
    return NextResponse.json({ revoked });
  } catch (error) {
    return errorResponseFromException(error, `DELETE /api/admin/team/${id}/sessions failed`);
  }
}
