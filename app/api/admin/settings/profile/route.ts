import { NextResponse, type NextRequest } from "next/server";

import { cafeProfileSchema } from "@/src/contracts/cafe-settings-schema";
import { UpdateCafeProfile } from "@/src/domain/use-cases/settings/CafeSettingsCommands";
import { cafeSettingsRepository } from "@/src/infrastructure/container";
import { invalidatesCatalog } from "@/src/lib/api/invalidatesCatalog";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { CATALOG_TAGS } from "@/src/lib/cache-tags";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/**
 * PUT /api/admin/settings/profile — the cafe's names, address, phone, Instagram,
 * website and map position. Requires `settings.write`. Answers with every
 * setting, and expires the site's cached copy.
 */
async function handlePut(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("settings.write");
  if (!session) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = cafeProfileSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const settings = await new UpdateCafeProfile(cafeSettingsRepository).execute(parsed.data, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(settings);
  } catch (error) {
    return errorResponseFromException(error, "PUT /api/admin/settings/profile failed");
  }
}

export const PUT = invalidatesCatalog([CATALOG_TAGS.settings], handlePut);
