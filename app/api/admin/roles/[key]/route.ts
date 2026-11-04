import { NextResponse, type NextRequest } from "next/server";

import { updateRoleSchema } from "@/src/contracts/role-schema";
import {
  GRANTABLE_ROLES,
  isCustomRoleKey,
  type CustomRoleKey,
  type GrantableBuiltInRole,
} from "@/src/domain/entities/User";
import { DeleteRole, UpdateRole } from "@/src/domain/use-cases/team/RoleCommands";
import { roleRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getOwnerSession } from "@/src/lib/require-admin";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ key: string }> };

/** The role a path names, when it names one the owner can manage (`owner` and `customer` never are). */
function manageableKey(raw: string): GrantableBuiltInRole | CustomRoleKey | null {
  const key = decodeURIComponent(raw);
  if (isCustomRoleKey(key)) return key;
  return GRANTABLE_ROLES.find((role) => role === key) ?? null;
}

/**
 * PUT /api/admin/roles/:key — change a role's permissions (and a custom role's
 * names). Owner only. The owner role isn't addressable here: it always holds
 * everything. `team.manage` is refused for any role (see `OWNER_ONLY_PERMISSIONS`).
 */
export async function PUT(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getOwnerSession();
  if (!session) return unauthorizedResponse();

  const key = manageableKey((await params).key);
  if (!key) return errorResponse(404, { message: "That role no longer exists.", code: "NOT_FOUND" });

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = updateRoleSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const { nameEn, nameFa, permissions } = parsed.data;
    // Names travel together: one without the other would leave a role named in only one language.
    if ((nameEn === undefined) !== (nameFa === undefined)) {
      return errorResponse(400, {
        message: "Give the role's name in both languages.",
        code: "VALIDATION",
        fieldErrors: { [nameEn === undefined ? "nameEn" : "nameFa"]: "roleNameRequired" },
      });
    }
    const role = await new UpdateRole(roleRepository).execute(
      key,
      {
        ...(nameEn !== undefined && nameFa !== undefined ? { name: { en: nameEn, fa: nameFa } } : {}),
        ...(permissions ? { permissions } : {}),
      },
      { id: session.user.id, name: session.user.name ?? session.user.id },
    );
    // The same shape the list and a create answer with: the editor checks it, and a
    // role without its member count read as a failed save though it had saved.
    const counts = await roleRepository.memberCounts();
    return NextResponse.json({ ...role, memberCount: counts[role.key] ?? 0 });
  } catch (error) {
    return errorResponseFromException(error, `PUT /api/admin/roles/${key} failed`);
  }
}

/**
 * DELETE /api/admin/roles/:key — delete a custom role. Owner only. 409
 * `ROLE_IN_USE` while anyone holds it, `ROLE_BUILT_IN` for a built-in role.
 */
export async function DELETE(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const session = await getOwnerSession();
  if (!session) return unauthorizedResponse();

  const key = manageableKey((await params).key);
  if (!key) return errorResponse(404, { message: "That role no longer exists.", code: "NOT_FOUND" });

  try {
    await new DeleteRole(roleRepository).execute(key, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponseFromException(error, `DELETE /api/admin/roles/${key} failed`);
  }
}
