import { NextResponse } from "next/server";

import { TransferOwnership } from "@/src/domain/use-cases/team/TransferOwnership";
import { teamNotifier, userRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getAppUrl } from "@/src/lib/appUrl";
import { getOwnerSession } from "@/src/lib/require-admin";

// Ownership must take effect immediately — never statically cached.
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PUT /api/admin/team/:id/owner — hand ownership of the store to this member.
 * Owner only.
 *
 * A swap, not a grant: the target becomes owner and the caller steps down to
 * admin (see `TransferOwnership`). This is the only way to change who the owner
 * is, which is what lets "the owner can't be removed" be a safe rule rather than
 * a trap.
 */
export async function PUT(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const session = await getOwnerSession();
  if (!session) return unauthorizedResponse();

  const { id } = await params;

  try {
    // Both sides are notified, so the notice links to the page the change is
    // about; the origin comes from the request (only the web layer knows it).
    const dashboardUrl = `${await getAppUrl()}/dashboard/team`;
    const owner = await new TransferOwnership(userRepository, teamNotifier).execute(
      id,
      session.user.id,
      dashboardUrl,
    );
    return NextResponse.json({ id: owner.id, role: owner.role });
  } catch (error) {
    return errorResponseFromException(error, `PUT /api/admin/team/${id}/owner failed`);
  }
}
