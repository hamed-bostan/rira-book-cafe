import { NextResponse, type NextRequest } from "next/server";

import type { TeamMember } from "@/src/contracts/team-response-schema";
import { grantAdminSchema } from "@/src/contracts/team-schema";
import type { User } from "@/src/domain/entities/User";
import { GrantAdmin } from "@/src/domain/use-cases/team/GrantAdmin";
import { ListTeam } from "@/src/domain/use-cases/team/ListTeam";
import { teamNotifier, userRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getAppUrl } from "@/src/lib/appUrl";
import { getOwnerSession } from "@/src/lib/require-admin";
import { breakGlassAdminIds, isBreakGlassAdmin } from "@/src/lib/require-permission";

// Who holds dashboard access is read per request — never statically cached.
export const dynamic = "force-dynamic";

/**
 * Project the team onto its rows, adding the facts only the API can know.
 *
 * `revokeBlocked` mirrors exactly what `RevokeAdmin` (plus the break-glass check
 * in the `[id]` route) will refuse, so the UI never offers a Remove the server
 * would reject. `transferable` likewise marks who could take ownership: anyone on
 * the team who isn't already the owner and isn't you.
 */
function toTeamMembers(members: User[], viewerId: string): TeamMember[] {
  return members.map((user) => {
    const breakGlass = isBreakGlassAdmin(user.id);
    const isSelf = user.id === viewerId;

    // Ordered to match the order the server actually applies the checks, so the
    // reason shown is the one a real attempt would come back with.
    const revokeBlocked = isSelf
      ? ("self" as const)
      : user.role === "owner"
        ? ("owner" as const)
        : breakGlass
          ? ("breakGlass" as const)
          : null;

    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      role: user.role === "owner" ? ("owner" as const) : ("admin" as const),
      isSelf,
      breakGlass,
      revokeBlocked,
      // Anyone who isn't already the owner can be made one. That includes *your*
      // row when you're a break-glass admin and the owner seat is vacant — the
      // bootstrap claim. When you are the owner your row is `owner`, so the same
      // condition excludes it without a special case.
      transferable: user.role !== "owner",
    };
  });
}

/**
 * GET /api/admin/team — everyone who can reach the dashboard. Owner only.
 *
 * Team management is owner-only throughout: an admin runs the cafe but doesn't
 * decide who else can. That keeps admin power non-symmetric, so no admin can
 * demote their peers.
 */
export async function GET(): Promise<NextResponse> {
  const session = await getOwnerSession();
  if (!session) return unauthorizedResponse();

  try {
    const members = await new ListTeam(userRepository).execute(breakGlassAdminIds());
    return NextResponse.json(toTeamMembers(members, session.user.id));
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/team failed");
  }
}

/**
 * POST /api/admin/team — grant admin access to a phone number. Owner only.
 *
 * Thin controller: authenticate → validate (same Zod schema the form uses) →
 * delegate to the use-case → map domain errors to HTTP status codes.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getOwnerSession();
  if (!session) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = grantAdminSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    // The invitation links back to this deployment's sign-in page, so the origin
    // is resolved from the request (only the web layer knows the public host).
    const signInUrl = `${await getAppUrl()}/login`;
    const granted = await new GrantAdmin(userRepository, teamNotifier).execute(
      parsed.data,
      session.user.id,
      signInUrl,
    );
    const [member] = toTeamMembers([granted], session.user.id);
    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/admin/team failed");
  }
}
