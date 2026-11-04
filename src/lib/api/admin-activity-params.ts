import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ENTITY_TYPES,
  FILTERABLE_ACTIVITY_FIELDS,
  type ActivityAction,
  type ActivityEntityType,
  type ActivityFilters,
} from "@/src/domain/entities/ActivityEntry";
import { cafeDayRange, isCafeDay } from "@/src/domain/entities/CafeTime";

/**
 * The wire contract for the activity log's filters — shared by the dashboard
 * toolbar, the CSV export and the admin route, like `admin-review-params.ts`.
 *
 * Query-param names: `actorId`, `entityType`, `entityId`, `field`, `action`,
 * `from`/`to` (cafe days, `YYYY-MM-DD`, both inclusive) and `q` (free text).
 *
 * `from`/`to` are cafe days rather than instants: the cafe's day runs on Tehran
 * time whatever the reader's clock says, and a day in the URL reads the same when
 * the link is shared. The server turns them into the instants the day spans.
 */

const ENTITY_TYPE_SET = new Set<string>(ACTIVITY_ENTITY_TYPES);
const FIELD_SET = new Set<string>(FILTERABLE_ACTIVITY_FIELDS);
const ACTION_SET = new Set<string>(ACTIVITY_ACTIONS);

/** Longest search accepted — longer is a paste, not a question. */
const MAX_SEARCH_LENGTH = 100;

/** The params that narrow the log (paging and ordering aside), for "is this filtered?" and "clear". */
export const ACTIVITY_FILTER_PARAMS = [
  "actorId",
  "entityType",
  "entityId",
  "field",
  "action",
  "from",
  "to",
  "q",
] as const;

export function parseAdminActivityFilters(params: URLSearchParams): ActivityFilters {
  const filters: ActivityFilters = {};

  const actorId = params.get("actorId")?.trim();
  if (actorId) filters.actorId = actorId;

  // Unrecognised values are dropped rather than answered with a 400, the rule
  // every list param follows: a stale or hand-edited URL lands on a sane
  // unfiltered page instead of an error screen.
  const entityType = params.get("entityType");
  if (entityType && ENTITY_TYPE_SET.has(entityType)) {
    filters.entityType = entityType as ActivityEntityType;
  }

  const entityId = params.get("entityId")?.trim();
  if (entityId) filters.entityId = entityId;

  // Restricted to the curated list rather than accepting any string. The column is
  // indexed and the query is safe either way, so this isn't about injection — it's
  // that `?field=nonsense` returning an empty page reads as "nothing happened"
  // rather than "that isn't a thing you can filter by".
  const field = params.get("field")?.trim();
  if (field && FIELD_SET.has(field)) filters.field = field;

  const action = params.get("action")?.trim();
  if (action && ACTION_SET.has(action)) filters.action = action as ActivityAction;

  const from = params.get("from")?.trim();
  if (from && isCafeDay(from)) filters.from = cafeDayRange(from).from;
  // Inclusive of the whole last day: up to the start of the next.
  const to = params.get("to")?.trim();
  if (to && isCafeDay(to)) filters.to = cafeDayRange(to).to;

  const search = params.get("q")?.trim().slice(0, MAX_SEARCH_LENGTH);
  if (search) filters.search = search;

  return filters;
}

/** Whether any filter narrows the log — to tell "nothing here" from "nothing matched". */
export function isActivityFiltered(params: URLSearchParams): boolean {
  return ACTIVITY_FILTER_PARAMS.some((name) => params.get(name));
}
