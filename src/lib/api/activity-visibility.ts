import {
  ACTIVITY_ENTITY_TYPES,
  type ActivityEntityType,
} from "@/src/domain/entities/ActivityEntry";

/**
 * Which slices of the activity log a viewer may read.
 *
 * One rule, and it's the one the app already had: `user` entries record who
 * granted or revoked dashboard access, and team management is owner-only — the
 * team page redirects a plain admin away and every `/api/admin/team/*` endpoint
 * answers them 401. Unifying the *storage* of that history with the rest of the
 * log was the point of this change; quietly publishing it to every admin was not.
 *
 * An allowlist rather than a denylist, so an entity type added later is invisible
 * to non-owners until someone decides otherwise — the safe direction to fail in.
 */
const OWNER_ONLY_ENTITY_TYPES: readonly ActivityEntityType[] = ["user"];

/**
 * The entity types this viewer may read, or `undefined` for "everything" — the
 * shape `ActivityFilters.visibleEntityTypes` expects, where absent means
 * unrestricted.
 */
export function visibleActivityEntityTypes(
  isOwner: boolean,
): readonly ActivityEntityType[] | undefined {
  if (isOwner) return undefined;
  return ACTIVITY_ENTITY_TYPES.filter((type) => !OWNER_ONLY_ENTITY_TYPES.includes(type));
}

/** Whether this viewer may read entries about `entityType` at all. */
export function canReadActivityEntityType(
  entityType: ActivityEntityType,
  isOwner: boolean,
): boolean {
  return isOwner || !OWNER_ONLY_ENTITY_TYPES.includes(entityType);
}
