import { NextResponse, type NextRequest } from "next/server";

import {
  ACTIVITY_SORTS,
  DEFAULT_ACTIVITY_DIRECTION,
  DEFAULT_ACTIVITY_SORT,
  toActivityEntityType,
} from "@/src/domain/entities/ActivityEntry";
import { GetEntityActivity } from "@/src/domain/use-cases/activity/GetEntityActivity";
import { ListActivity } from "@/src/domain/use-cases/activity/ListActivity";
import { activityLog } from "@/src/infrastructure/container";
import {
  canReadActivityEntityType,
  redactActivityEntry,
  visibleActivityEntityTypes,
} from "@/src/lib/api/activity-visibility";
import { parseAdminActivityFilters } from "@/src/lib/api/admin-activity-params";
import { parsePageRequest } from "@/src/lib/api/pagination-params";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith, sessionPermissions } from "@/src/lib/require-permission";

// Reads the audit trail per request — an audit trail that showed a cached past
// would be worthless.
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/activity — the audit trail, newest first. Requires `activity.view`,
 * and each kind of entry takes the permission for what it describes, so the books
 * and payroll stay with those who can read them (see `activity-visibility`).
 *
 * Two shapes, chosen by whether `limit` is present:
 *
 *   ?page&pageSize&dir&actorId&entityType&entityId&field&action&from&to&q → `{ items, total, page, pageSize }`
 *   ?entityType&entityId&limit                     → `[…]`, one entity's history
 *
 * The second is what the per-entity panels on the order and product screens read.
 * It's the same endpoint rather than a nested `/api/admin/<entity>/:id/activity`
 * because the filter is already part of this resource's vocabulary — a panel is a
 * page of the log narrowed to one entity, and a second route would be a second
 * place to keep the admin guard correct.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("activity.view");
  if (!session) return unauthorizedResponse();

  // What decides which entries are readable. It's a second lookup on the request,
  // which this traffic can afford, and the trade every guard makes to keep
  // revocation instant.
  const permissions = await sessionPermissions(session);

  const params = request.nextUrl.searchParams;
  const filters = parseAdminActivityFilters(params);

  try {
    const rawLimit = params.get("limit");
    if (rawLimit !== null) {
      // A panel read. An unrecognised type narrows to `unknown` and matches
      // nothing, which is the right answer for `?entityType=nonsense` — an empty
      // panel, not a 400.
      const entityType = toActivityEntityType(params.get("entityType") ?? "");
      // Refused rather than silently emptied: a panel is asked for by id, so "you
      // may not read this kind" is a real answer, not a stale filter to shrug off.
      if (!canReadActivityEntityType(entityType, permissions)) return unauthorizedResponse();

      const entries = await new GetEntityActivity(activityLog).execute(
        entityType,
        params.get("entityId") ?? "",
        Number(rawLimit),
      );
      return NextResponse.json(entries.map((entry) => toWire(redactActivityEntry(entry, permissions))));
    }

    const page = parsePageRequest(params, ACTIVITY_SORTS, {
      sort: DEFAULT_ACTIVITY_SORT,
      direction: DEFAULT_ACTIVITY_DIRECTION,
    });
    const result = await new ListActivity(activityLog).execute(
      // Applied last so it can't be overwritten by anything parsed off the query
      // string — the restriction is the viewer's, not the caller's to set.
      { ...filters, visibleEntityTypes: visibleActivityEntityTypes(permissions) },
      page,
    );
    return NextResponse.json({
      ...result,
      items: result.items.map((entry) => toWire(redactActivityEntry(entry, permissions))),
    });
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/activity failed");
  }
}

/** Dates cross the wire as ISO strings; the client schema parses them back. */
function toWire<T extends { at: Date }>(entry: T): Omit<T, "at"> & { at: string } {
  return { ...entry, at: entry.at.toISOString() };
}
