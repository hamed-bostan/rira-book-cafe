import { NextResponse, type NextRequest } from "next/server";

import {
  ACTIVITY_SORTS,
  DEFAULT_ACTIVITY_DIRECTION,
  DEFAULT_ACTIVITY_SORT,
  toActivityAction,
  toActivityEntityType,
} from "@/src/domain/entities/ActivityEntry";
import { GetEntityActivity } from "@/src/domain/use-cases/activity/GetEntityActivity";
import { ListActivity } from "@/src/domain/use-cases/activity/ListActivity";
import { activityLog } from "@/src/infrastructure/container";
import {
  canReadActivityEntityType,
  visibleActivityEntityTypes,
} from "@/src/lib/api/activity-visibility";
import { parseAdminActivityFilters } from "@/src/lib/api/admin-activity-params";
import { parsePageRequest } from "@/src/lib/api/pagination-params";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { isOwner } from "@/src/lib/require-admin";
import { getSessionWith } from "@/src/lib/require-permission";

// Reads the audit trail per request — an audit trail that showed a cached past
// would be worthless.
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/activity — the admin audit trail, newest first. Admin only, with
 * team-access entries reserved to the owner (see `activity-visibility`).
 *
 * Two shapes, chosen by whether `limit` is present:
 *
 *   ?page&pageSize&dir&actorId&entityType&entityId → `{ items, total, page, pageSize }`
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

  // The owner check is what decides whether team-access history is readable. It's
  // a second lookup on an admin request, which admin traffic can afford — and the
  // same trade `isAdmin` already makes to keep revocation instant.
  const owner = await isOwner(session);

  const params = request.nextUrl.searchParams;
  const filters = parseAdminActivityFilters(params);

  // Only the team page asks for one action; the dashboard's own filters don't
  // offer it (see `admin-activity-params`), so it's read straight from the query
  // and narrowed here. An unrecognised value narrows to `unknown`, which matches
  // no real entry — an empty list, not an error, like every other bad list param.
  const action = params.get("action");
  if (action) filters.action = toActivityAction(action);

  try {
    const rawLimit = params.get("limit");
    if (rawLimit !== null) {
      // A panel read. An unrecognised type narrows to `unknown` and matches
      // nothing, which is the right answer for `?entityType=nonsense` — an empty
      // panel, not a 400.
      const entityType = toActivityEntityType(params.get("entityType") ?? "");
      // Refused rather than silently emptied: a panel is asked for by id, so "you
      // may not read this kind" is a real answer, not a stale filter to shrug off.
      if (!canReadActivityEntityType(entityType, owner)) return unauthorizedResponse();

      const entries = await new GetEntityActivity(activityLog).execute(
        entityType,
        params.get("entityId") ?? "",
        Number(rawLimit),
      );
      return NextResponse.json(entries.map(toWire));
    }

    const page = parsePageRequest(params, ACTIVITY_SORTS, {
      sort: DEFAULT_ACTIVITY_SORT,
      direction: DEFAULT_ACTIVITY_DIRECTION,
    });
    const result = await new ListActivity(activityLog).execute(
      // Applied last so it can't be overwritten by anything parsed off the query
      // string — the restriction is the viewer's, not the caller's to set.
      { ...filters, visibleEntityTypes: visibleActivityEntityTypes(owner) },
      page,
    );
    return NextResponse.json({ ...result, items: result.items.map(toWire) });
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/activity failed");
  }
}

/** Dates cross the wire as ISO strings; the client schema parses them back. */
function toWire<T extends { at: Date }>(entry: T): Omit<T, "at"> & { at: string } {
  return { ...entry, at: entry.at.toISOString() };
}
