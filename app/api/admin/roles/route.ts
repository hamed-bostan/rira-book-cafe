import { NextResponse, type NextRequest } from "next/server";

import { createRoleSchema } from "@/src/contracts/role-schema";
import { CreateRole, ListRoles } from "@/src/domain/use-cases/team/RoleCommands";
import { roleRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getOwnerSession } from "@/src/lib/require-admin";

// Roles decide what everyone may do — always read fresh.
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/roles — the editable built-in roles and the owner's own, each with
 * its permissions and how many people hold it. Owner only, like the rest of the team.
 */
export async function GET(): Promise<NextResponse> {
  if (!(await getOwnerSession())) return unauthorizedResponse();
  try {
    return NextResponse.json(await new ListRoles(roleRepository).execute());
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/roles failed");
  }
}

/**
 * POST /api/admin/roles — create a custom role. Owner only. Thin controller:
 * authenticate → validate (the form's schema) → `CreateRole`, which refuses
 * owner-only permissions and duplicate names, and records the change.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getOwnerSession();
  if (!session) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = createRoleSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const { nameEn, nameFa, permissions } = parsed.data;
    const role = await new CreateRole(roleRepository).execute(
      { name: { en: nameEn, fa: nameFa }, permissions },
      { id: session.user.id, name: session.user.name ?? session.user.id },
    );
    return NextResponse.json({ ...role, memberCount: 0 }, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/admin/roles failed");
  }
}
