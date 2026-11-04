import { NextResponse } from "next/server";

import { GetCafeSettings } from "@/src/domain/use-cases/settings/CafeSettingsCommands";
import { cafeSettingsRepository } from "@/src/infrastructure/container";
import { errorResponseFromException } from "@/src/lib/api/responses";

export const dynamic = "force-dynamic";

/**
 * GET /api/settings — the cafe's profile (names, address, phone, links, map
 * position), opening hours and receipt copy. Public: it's what the site and every
 * receipt show. The storefront caches it under `CATALOG_TAGS.settings`, which the
 * settings writes expire.
 */
export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json(await new GetCafeSettings(cafeSettingsRepository).execute());
  } catch (error) {
    return errorResponseFromException(error, "GET /api/settings failed");
  }
}
