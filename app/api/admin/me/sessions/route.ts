import { NextResponse } from "next/server";

import { ListSessions, RevokeAllSessions } from "@/src/domain/use-cases/sessions/SessionCommands";
import { sessionRepository, userRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { toSessionWire } from "@/src/lib/api/session-wire";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/me/sessions — where you're signed in, this browser marked. Any
 * dashboard user, for their own account.
 */
export async function GET(): Promise<NextResponse> {
  const session = await getSessionWith("dashboard.view");
  if (!session) return unauthorizedResponse();
  try {
    const sessions = await new ListSessions(sessionRepository).execute(session.user.id, session.sessionId ?? null);
    return NextResponse.json(sessions.map(toSessionWire));
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/me/sessions failed");
  }
}

/** DELETE /api/admin/me/sessions — sign out everywhere except this browser. */
export async function DELETE(): Promise<NextResponse> {
  const session = await getSessionWith("dashboard.view");
  if (!session) return unauthorizedResponse();
  try {
    const revoked = await new RevokeAllSessions(sessionRepository, userRepository).execute(
      { userId: session.user.id, actor: { id: session.user.id, name: session.user.name ?? session.user.id } },
      session.sessionId,
    );
    return NextResponse.json({ revoked });
  } catch (error) {
    return errorResponseFromException(error, "DELETE /api/admin/me/sessions failed");
  }
}
