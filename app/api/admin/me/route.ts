import { NextResponse } from "next/server";

import type { UserRole } from "@/src/domain/entities/User";
import { userRepository } from "@/src/infrastructure/container";
import { errorResponse, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith, sessionRole } from "@/src/lib/require-permission";

/** What this route promises — the presentation layer's `viewerResponseSchema` (colocated with its one consumer) validates the client sees exactly this. */
type ViewerBody = { id: string; name: string; email: string | null; imageUrl: string | null; role: UserRole };

// Per-session, request-time data — never statically cached.
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/me — the signed-in dashboard user's own display fields
 * (name, email, avatar) plus their effective role, for the shell chrome
 * (sidebar user card, top bar menu). Gated on `dashboard.view`, same as the
 * layout that calls it — every dashboard role qualifies, this is a "who am
 * I" read, not a team-management one.
 *
 * `sessionRole` rather than the row's own `role`: a break-glass admin's row
 * can lag the `owner` override `ADMIN_USER_IDS` grants it.
 */
export async function GET(): Promise<NextResponse> {
  const session = await getSessionWith("dashboard.view");
  if (!session) return unauthorizedResponse();

  const [user, role] = await Promise.all([
    userRepository.getById(session.user.id),
    sessionRole(session),
  ]);

  // The account backing an active session vanished mid-request (deleted
  // between the permission check and this read). Nothing sensible to draw
  // for that — the caller falls back to sending the viewer to the door.
  if (!user || role == null) {
    return errorResponse(404, { message: "That user no longer exists.", code: "NOT_FOUND" });
  }

  const body: ViewerBody = { id: user.id, name: user.name, email: user.email, imageUrl: user.avatarUrl, role };
  return NextResponse.json(body);
}
