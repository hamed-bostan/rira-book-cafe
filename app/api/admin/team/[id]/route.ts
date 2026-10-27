import { NextResponse, type NextRequest } from "next/server";

import { changeRoleSchema } from "@/src/contracts/team-schema";
import { ChangeRole } from "@/src/domain/use-cases/team/ChangeRole";
import { RevokeAdmin } from "@/src/domain/use-cases/team/RevokeAdmin";
import { userRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getOwnerSession } from "@/src/lib/require-admin";
import { isBreakGlassAdmin } from "@/src/lib/require-permission";

// Role changes must take effect immediately — never statically cached.
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Break-glass access lives in the environment, so nothing written here would change it. */
function breakGlassResponse(action: string): NextResponse {
  return errorResponse(409, {
    message: `This admin is configured in the environment and can't be ${action} here.`,
    code: "REVOKE_BREAK_GLASS",
  });
}

/**
 * PUT /api/admin/team/:id — move a team member to another role. Owner only.
 *
 * Thin controller: authenticate → validate (the same Zod schema the dialog uses)
 * → delegate to `ChangeRole`, which refuses you and the owner. Break-glass access
 * is refused here, as it is for a revoke: the role it grants comes from the
 * environment, so a new one in the database would report success and change
 * nothing.
 */
export async function PUT(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getOwnerSession();
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  if (isBreakGlassAdmin(id)) return breakGlassResponse("changed");

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = changeRoleSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const member = await new ChangeRole(userRepository).execute(id, parsed.data.role, session.user.id);
    return NextResponse.json({ id: member.id, role: member.role });
  } catch (error) {
    return errorResponseFromException(error, `PUT /api/admin/team/${id} failed`);
  }
}

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
  if (isBreakGlassAdmin(id)) return breakGlassResponse("removed");

  try {
    await new RevokeAdmin(userRepository).execute(id, session.user.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponseFromException(error, `DELETE /api/admin/team/${id} failed`);
  }
}
