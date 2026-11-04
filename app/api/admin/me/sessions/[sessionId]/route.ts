import { NextResponse } from "next/server";

import { RevokeSession } from "@/src/domain/use-cases/sessions/SessionCommands";
import { sessionRepository, userRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ sessionId: string }> };

/**
 * DELETE /api/admin/me/sessions/:sessionId — sign one of your browsers out (this
 * one included: that's signing out). 404 when it isn't one of your active sessions.
 */
export async function DELETE(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("dashboard.view");
  if (!session) return unauthorizedResponse();
  const { sessionId } = await params;
  try {
    await new RevokeSession(sessionRepository, userRepository).execute(
      { userId: session.user.id, actor: { id: session.user.id, name: session.user.name ?? session.user.id } },
      sessionId,
    );
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponseFromException(error, `DELETE /api/admin/me/sessions/${sessionId} failed`);
  }
}
