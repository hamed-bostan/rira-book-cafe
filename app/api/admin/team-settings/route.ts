import { NextResponse, type NextRequest } from "next/server";

import { teamSettingsSchema } from "@/src/contracts/team-security-schema";
import { GetTeamSettings, UpdateTeamSettings } from "@/src/domain/use-cases/team/TeamSettingsCommands";
import { teamSettingsRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getOwnerSession } from "@/src/lib/require-admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/team-settings — the team's security settings. Owner only.
 */
export async function GET(): Promise<NextResponse> {
  if (!(await getOwnerSession())) return unauthorizedResponse();
  try {
    const settings = await new GetTeamSettings(teamSettingsRepository).execute();
    return NextResponse.json(settings);
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/team-settings failed");
  }
}

/**
 * PUT /api/admin/team-settings — change them. Owner only.
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const session = await getOwnerSession();
  if (!session) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = teamSettingsSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const settings = await new UpdateTeamSettings(teamSettingsRepository).execute(parsed.data, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(settings);
  } catch (error) {
    return errorResponseFromException(error, "PUT /api/admin/team-settings failed");
  }
}
