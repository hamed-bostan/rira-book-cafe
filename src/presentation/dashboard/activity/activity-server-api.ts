import type { ActivityAction, ActivityEntityType } from "@/src/domain/entities/ActivityEntry";
import type { Page } from "@/src/domain/entities/Pagination";
import { pageResponseSchema } from "@/src/lib/api/page-response-schema";
import { serverApiGet } from "@/src/lib/api/server-client";

import {
  activityActorListResponseSchema,
  activityEntryListResponseSchema,
  activityEntryResponseSchema,
  type ActivityActorWire,
  type ActivityEntryWire,
} from "./activity-response-schema";

const activityPageResponseSchema = pageResponseSchema(activityEntryResponseSchema);

/**
 * Server-side activity reads for the admin dashboard (BFF). `serverApiGet`
 * forwards the admin's session cookie so the admin endpoints authorize the calls.
 *
 * Read-only, and there is no browser counterpart: nothing in the UI writes to the
 * log, so there is no `activityApi` to pair with this. That's the point — entries
 * are written by the use-cases behind the changes they describe, never by a client
 * asking for one.
 */
export const activityServerApi = {
  /** One page of the log, with the filters and ordering the caller's query string carries. */
  listPage(params: URLSearchParams): Promise<Page<ActivityEntryWire>> {
    return serverApiGet("/admin/activity", activityPageResponseSchema, {
      params: Object.fromEntries(params),
    });
  },

  /** One entity's own history, newest first — the detail screens' panels. */
  listForEntity(
    entityType: ActivityEntityType,
    entityId: string,
    limit: number,
  ): Promise<ActivityEntryWire[]> {
    return serverApiGet("/admin/activity", activityEntryListResponseSchema, {
      params: { entityType, entityId, limit: String(limit) },
    });
  },

  /** One action's entries, newest first — the team page's access history. */
  listForAction(action: ActivityAction, limit: number): Promise<ActivityEntryWire[]> {
    return serverApiGet("/admin/activity", activityPageResponseSchema, {
      params: { action, pageSize: String(limit) },
    }).then((page) => page.items);
  },

  /** The people who appear in the log, for the actor filter. */
  listActors(): Promise<ActivityActorWire[]> {
    return serverApiGet("/admin/activity/actors", activityActorListResponseSchema);
  },
};
