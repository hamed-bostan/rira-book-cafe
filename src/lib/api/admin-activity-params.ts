import {
  ACTIVITY_ENTITY_TYPES,
  FILTERABLE_ACTIVITY_FIELDS,
  type ActivityEntityType,
  type ActivityFilters,
} from "@/src/domain/entities/ActivityEntry";

/**
 * The wire contract for the activity log's filters — shared by the dashboard
 * toolbar and the admin route, like `admin-review-params.ts`.
 *
 * Query-param names: `actorId`, `entityType`, `entityId`, `field`.
 *
 * `action` is deliberately not a query param. The page filters by *what was
 * changed*, not by which of the twelve verbs was used, and offering both would be
 * two dropdowns whose combinations are mostly empty. The port still supports it
 * for the callers that need one action (the team page's role history).
 */

const ENTITY_TYPE_SET = new Set<string>(ACTIVITY_ENTITY_TYPES);
const FIELD_SET = new Set<string>(FILTERABLE_ACTIVITY_FIELDS);

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

  return filters;
}

export function buildAdminActivityParams(filters: ActivityFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.actorId) params.set("actorId", filters.actorId);
  if (filters.entityType) params.set("entityType", filters.entityType);
  if (filters.entityId) params.set("entityId", filters.entityId);
  if (filters.field) params.set("field", filters.field);
  return params;
}
