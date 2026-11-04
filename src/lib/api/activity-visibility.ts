import {
  ACTIVITY_ENTITY_TYPES,
  type ActivityChange,
  type ActivityEntityType,
} from "@/src/domain/entities/ActivityEntry";
import type { Permission } from "@/src/domain/entities/Permission";

/**
 * Which slices of the activity log a viewer may read.
 *
 * The log holds a copy of what every other screen guards, and `activity.view` is
 * held by every dashboard role, floor staff included. So reading an entry takes the
 * same permission as reading what it describes: the books are for `accounting.view`,
 * who's paid what for `payroll.manage`, and who granted dashboard access for the
 * owner, whose team page answers everyone else 401. Without this, the log is a way
 * round each of those guards.
 *
 * A `Record` over the entity types, so a type added later doesn't compile until
 * someone decides who may read it: the safe direction to fail in.
 */
const ENTITY_TYPE_NEEDS: Record<(typeof ACTIVITY_ENTITY_TYPES)[number], Permission> = {
  product: "activity.view",
  category: "activity.view",
  order: "activity.view",
  review: "activity.view",
  promoCode: "activity.view",
  reservation: "activity.view",
  suiteBooking: "activity.view",
  bookLoan: "activity.view",
  event: "activity.view",
  user: "team.manage",
  // Who a guest is is on every booking and order the floor reads already.
  guest: "activity.view",
  ledger: "accounting.view",
  expense: "accounting.view",
  income: "accounting.view",
  payroll: "payroll.manage",
  // The till's figures are the shift screen's, which the floor holds.
  cashShift: "shifts.manage",
  // That the log itself was pruned is for everyone who reads it.
  activity: "activity.view",
};

/**
 * Fields whose figures are guarded inside an entry anyone may read. A cost price
 * sits on a product's history, and costs are `accounting.view`'s, as they are on
 * the stock screens. The viewer still sees that it changed, not what to.
 */
const FIELD_NEEDS: Readonly<Partial<Record<string, Permission>>> = {
  costPrice: "accounting.view",
};

/**
 * The entity types this viewer may read, or `undefined` for "everything" — the
 * shape `ActivityFilters.visibleEntityTypes` expects, where absent means
 * unrestricted. Only the owner holds `team.manage`, and with it every permission.
 */
export function visibleActivityEntityTypes(
  permissions: readonly Permission[],
): readonly ActivityEntityType[] | undefined {
  if (permissions.includes("team.manage")) return undefined;
  return ACTIVITY_ENTITY_TYPES.filter((type) => permissions.includes(ENTITY_TYPE_NEEDS[type]));
}

/**
 * Whether this viewer may read entries about `entityType` at all. `unknown` is a
 * query for a type this build doesn't know, which matches nothing: an empty panel,
 * not a refusal.
 */
export function canReadActivityEntityType(entityType: ActivityEntityType, permissions: readonly Permission[]): boolean {
  return entityType === "unknown" || permissions.includes(ENTITY_TYPE_NEEDS[entityType]);
}

/** An entry as this viewer may read it: any field they can't see keeps its name and loses its figures. */
export function redactActivityEntry<T extends { changes: ActivityChange[] }>(
  entry: T,
  permissions: readonly Permission[],
): T {
  const hidden = (change: ActivityChange): boolean => {
    const needs = FIELD_NEEDS[change.field];
    return needs !== undefined && !permissions.includes(needs);
  };
  if (!entry.changes.some(hidden)) return entry;
  return {
    ...entry,
    changes: entry.changes.map((change) => (hidden(change) ? { ...change, before: null, after: null } : change)),
  };
}
