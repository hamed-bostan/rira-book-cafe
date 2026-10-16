import { NextResponse } from "next/server";

import { RevokeAdmin } from "@/src/domain/use-cases/team/RevokeAdmin";
import { userRepository } from "@/src/infrastructure/container";
import { errorResponse, errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getOwnerSession } from "@/src/lib/require-admin";
import { isBreakGlassAdmin } from "@/src/lib/require-permission";

// Revocation must take effect immediately — never statically cached.
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * DELETE /api/admin/team/:id — withdraw a user's dashboard access. Owner only.
 *
 * The account survives; only the role is taken away. The use-case refuses to
 * remove you or the owner; break-glass access is refused here instead, because it
 * lives in the environment rather than the database — clearing the role would
 * report success while the person still walked straight back in.
 */
export async function DELETE(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const session = await getOwnerSession();
  if (!session) return unauthorizedResponse();

  const { id } = await params;

  if (isBreakGlassAdmin(id)) {
    return errorResponse(409, {
      message: "This admin is configured in the environment and can't be removed here.",
      code: "REVOKE_BREAK_GLASS",
    });
  }

  try {
    await new RevokeAdmin(userRepository).execute(id, session.user.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponseFromException(error, `DELETE /api/admin/team/${id} failed`);
  }
}
