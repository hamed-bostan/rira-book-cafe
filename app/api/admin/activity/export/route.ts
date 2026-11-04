import { type NextRequest } from "next/server";

import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import type { RoleName } from "@/src/domain/entities/Role";
import { ExportActivity } from "@/src/domain/use-cases/activity/ExportActivity";
import { ListRoles } from "@/src/domain/use-cases/team/RoleCommands";
import { activityLog, roleRepository } from "@/src/infrastructure/container";
import { parseCsvLocale } from "@/src/lib/api/accounting-csv";
import { activityCsv } from "@/src/lib/api/activity-csv";
import { redactActivityEntry, visibleActivityEntityTypes } from "@/src/lib/api/activity-visibility";
import { parseAdminActivityFilters } from "@/src/lib/api/admin-activity-params";
import { csvStreamResponse } from "@/src/lib/api/csv-response";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith, sessionPermissions } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/activity/export — the activity log as a CSV download, newest
 * first, with the same filters as the page (`actorId`, `entityType`, `field`,
 * `action`, `from`/`to`, `q`) and in `?locale=`. Requires `activity.view`, and it
 * holds only what the reader may read: the same entity-type restriction and the
 * same redaction of guarded figures as the page (see `activity-visibility`).
 * Streamed, so a long log costs no more memory than a short one.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const session = await getSessionWith("activity.view");
  if (!session) return unauthorizedResponse();

  const params = request.nextUrl.searchParams;
  const locale = parseCsvLocale(params);

  try {
    const permissions = await sessionPermissions(session);
    // Applied last, so nothing on the query string can widen what this reader sees.
    const filters = {
      ...parseAdminActivityFilters(params),
      visibleEntityTypes: visibleActivityEntityTypes(permissions),
    };
    // Custom roles are named in role-change entries, which only the owner reads.
    const roleNames: Record<string, RoleName> = {};
    if (permissions.includes("team.manage")) {
      for (const role of await new ListRoles(roleRepository).execute()) {
        if (role.name) roleNames[role.key] = role.name;
      }
    }

    const batches = redacted(new ExportActivity(activityLog).execute(filters), permissions);
    return csvStreamResponse(`activity-${cafeDayOf(new Date())}.csv`, activityCsv(batches, locale, roleNames));
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/activity/export failed");
  }
}

async function* redacted<T extends { changes: { field: string; before: string | null; after: string | null }[] }>(
  batches: AsyncIterable<T[]>,
  permissions: Parameters<typeof redactActivityEntry>[1],
): AsyncGenerator<T[]> {
  for await (const batch of batches) yield batch.map((entry) => redactActivityEntry(entry, permissions));
}
