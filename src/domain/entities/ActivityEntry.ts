/**
 * The activity log: one entry per admin-visible change, whatever it changed.
 *
 * The generalisation of what began as `RoleChange` — a log that only covered team
 * grants, sitting next to a stock ledger that only covered quantities, next to
 * nothing at all for the catalog, orders, reviews and campaigns. Three logs with
 * three shapes answer "who changed this?" three different ways, and answer it not
 * at all for everything they don't cover. This is the one log, and role changes
 * fold into it rather than living beside it.
 *
 * It does *not* replace the stock ledger. That ledger answers a different
 * question — "what is this product's running quantity, and how did it get here" —
 * with a `quantityAfter` running balance the inventory side reads as arithmetic.
 * This log records that an adjustment happened, who made it and what the level was
 * before; `StockMovement` remains the accounting record. Two records of the same
 * event, kept because they're read for different reasons.
 *
 * Framework-free, so it's importable from anywhere in the app.
 */

/**
 * What kind of thing an entry is about — and the entity filter's vocabulary,
 * which is why this list holds only the types someone would filter *by*.
 */
export const ACTIVITY_ENTITY_TYPES = [
  "product",
  "category",
  "order",
  "review",
  "promoCode",
  "user",
  "reservation",
  "event",
  // Accounting: journal entries, the chart of accounts and its settings ("ledger"),
  // and supplier bills ("expense").
  "ledger",
  "expense",
] as const;

/**
 * A recognised entity type, or `unknown` for a stored value this build doesn't
 * know — a row written by a newer deployment, or one whose type was renamed.
 *
 * The fallback exists rather than dropping such rows on read. Every other
 * narrowing in the app falls back to a neutral value (`toUserRole` → `customer`,
 * `toStockMovementReason` → `correction`) and this one has a stronger reason to:
 * an audit log that quietly omits the entries it can't classify is lying by
 * omission about the one thing it's for. An unrecognised entry still renders —
 * generically, but with its actor, timestamp and diff intact.
 */
export type ActivityEntityType = (typeof ACTIVITY_ENTITY_TYPES)[number] | "unknown";

/**
 * What happened, namespaced by entity type.
 *
 * A closed set, for the same reason `StockMovementReason` is one: a free-text
 * action field collects four spellings of the same event within a month, and the
 * log's whole value is that you can ask it a question and trust the answer.
 *
 * Deliberately coarser than "one action per field": a product save that touched
 * the price, the name and the stock is one `product.updated`, not three entries.
 * Which fields moved — and what they were before — is the `changes` diff's job.
 * Splitting `price` into its own action would mean either two entries for one save
 * or an arbitrary rule about which field "wins".
 */
export const ACTIVITY_ACTIONS = [
  "product.created",
  "product.updated",
  "product.deleted",
  "category.created",
  "category.updated",
  "category.deleted",
  // No `order.created`: an order is only ever created by the customer placing it,
  // and the order row already records who that is. The log exists for the changes
  // *staff* make to something stored.
  "order.stageChanged",
  "order.paymentChanged",
  // The one action here that isn't a change to anything stored — an admin sent the
  // customer a message about their order. Recorded through
  // `IActivityLog.recordEvent` rather than an audit hook, because there is no
  // transaction to ride; see that method for why the rule doesn't reach it.
  "order.customerNotified",
  "review.moderated",
  "promoCode.created",
  "promoCode.updated",
  "promoCode.activeChanged",
  "user.roleChanged",
  "reservation.changed",
  "event.created",
  "event.updated",
  "event.deleted",
  "event.registrationCancelled",
  // The books. Order postings aren't logged here — the order's own status and
  // payment entries already are, and the journal names who posted each line.
  "ledger.entryPosted",
  "ledger.entryReversed",
  "ledger.accountChanged",
  "ledger.settingsChanged",
  // The till counted and closed for a day (with its over/short and deposit).
  "ledger.cashClosed",
  // Bank reconciliation: a statement entered or its lines changed, lines matched
  // or unmatched, and the statement signed off.
  "ledger.bankStatementChanged",
  "ledger.bankMatched",
  "ledger.bankUnmatched",
  "ledger.bankReconciled",
  "expense.recorded",
  "expense.paid",
  "expense.voided",
  // Another event rather than a change to anything stored — an admin downloaded a
  // customer-data export. Recorded through `IActivityLog.recordEvent`, same as
  // `order.customerNotified`: the file has already left the moment this is
  // written, so there is nothing to be atomic with.
  // A standing scheduled-export rule was authored/edited, paused/resumed, or
  // removed — the Scheduled reports panel's own audit trail. A schedule
  // *firing* isn't logged here: it's an automated background action (see
  // `RunDueSchedules`), not something an admin did.
] as const;

/** A recognised action, or `unknown` — see {@link ActivityEntityType} for why. */
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number] | "unknown";

/** Narrow an arbitrary stored string to an action, falling back to `unknown`. */
export function toActivityAction(value: string): ActivityAction {
  return (ACTIVITY_ACTIONS as readonly string[]).includes(value)
    ? (value as ActivityAction)
    : "unknown";
}

/** Narrow an arbitrary stored string to an entity type, falling back to `unknown`. */
export function toActivityEntityType(value: string): ActivityEntityType {
  return (ACTIVITY_ENTITY_TYPES as readonly string[]).includes(value)
    ? (value as ActivityEntityType)
    : "unknown";
}

/**
 * One field that moved, with both sides of the move.
 *
 * Values are strings — already formatted at write time — rather than the original
 * scalars. The log holds fields from every entity in the app, so a typed union
 * would have to enumerate them all, and a `Json` blob of mixed types would push
 * "what shape is this?" onto every reader. A string renders the same whether it
 * came from a price, a role or a delivery stage, and the entry stays readable
 * years later without the entity it describes still existing to interpret it.
 *
 * `null` means the field was unset on that side — absent, not empty.
 */
export type ActivityChange = {
  field: string;
  before: string | null;
  after: string | null;
};

/** Who made a change. Threaded from the session down through the use-cases. */
export type ActivityActor = {
  id: string;
  name: string;
};

/**
 * One recorded change.
 *
 * `actorName` and `entityLabel` are snapshotted at write time rather than joined
 * on read — the same treatment the stock ledger and order lines give their names.
 * A log that resolves its labels live stops being a record of what happened and
 * becomes a view of what currently exists: rename a product and last month's entry
 * silently describes a different thing; delete it and the entry can't be read at
 * all. The ids are still there for anyone who wants to follow the entry to the
 * thing it's about, when that thing is still around.
 */
export type ActivityEntry = {
  id: string;
  /** Who made the change. */
  actorId: string;
  /** The actor's name at the time. */
  actorName: string;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId: string;
  /** How the entity read at the time — a product name, a promo code, a person's name. */
  entityLabel?: string;
  /** The fields that moved. Empty for actions where the event *is* the change. */
  changes: ActivityChange[];
  at: Date;
};

/** An entry about to be recorded. The id and timestamp are the store's to assign. */
export type NewActivityEntry = Omit<ActivityEntry, "id" | "at">;

/** Columns the log can be ordered by — an audit trail is read chronologically. */
export const ACTIVITY_SORTS = ["at"] as const;
export type ActivitySort = (typeof ACTIVITY_SORTS)[number];

export const DEFAULT_ACTIVITY_SORT: ActivitySort = "at";
export const DEFAULT_ACTIVITY_DIRECTION = "desc";

/** Narrowing the log to one actor and/or one entity — what the activity page filters by. */
export type ActivityFilters = {
  actorId?: string;
  entityType?: ActivityEntityType;
  /** A single entity's history. Only meaningful alongside `entityType`. */
  entityId?: string;
  action?: ActivityAction;
  /**
   * Narrow to entries whose diff touched this field — "every price change",
   * "every time capacity moved".
   *
   * This is why a product save is one `product.updated` entry rather than one
   * event per field: the event stays a faithful record of a single operation (the
   * shape every audit trail worth copying uses), and the question "what changed
   * about the price" is answered by querying the diff instead of by fragmenting
   * the log. Backed by `changedFields` + a GIN index, so it's an index scan rather
   * than a scan of every JSON blob.
   */
  field?: string;
  /**
   * Which entity types the *viewer* is allowed to see, as opposed to which ones
   * they asked for. Absent means no restriction.
   *
   * Separate from `entityType` on purpose, and not merely a second value for it: a
   * viewer's permission and a reader's choice compose (an admin filtering to
   * "products" gets products; an admin filtering to "team" gets nothing, not an
   * error), and collapsing them into one field would let a query param widen what
   * someone may read. It's here rather than in the route because a `where` clause
   * is the only place a restriction can't be forgotten by the next caller.
   *
   * Today this carries exactly one rule: `user` entries — who granted whom
   * dashboard access — stay owner-only, which is the boundary the team page and
   * its endpoints already drew. Folding role changes into this log unified the
   * *storage*, and deliberately did not widen the audience.
   */
  visibleEntityTypes?: readonly ActivityEntityType[];
};

/** One option in the actor filter — the distinct people who appear in the log. */
export type ActivityActorOption = {
  id: string;
  /** The most recent name recorded for them, since entries snapshot it. */
  name: string;
};

/** How many entries a per-entity panel reads when the caller doesn't say. */
export const DEFAULT_ACTIVITY_LIMIT = 20;

/**
 * Hard ceiling on entries per panel read. The limit can arrive from a query
 * string, so it's caller-controlled input — the same clamp `clampMovementLimit`
 * applies for the same reason.
 */
export const MAX_ACTIVITY_LIMIT = 100;

/** Coerce a possibly-hostile limit into a safe one. */
export function clampActivityLimit(limit?: number): number {
  if (!Number.isFinite(limit)) return DEFAULT_ACTIVITY_LIMIT;
  return Math.min(MAX_ACTIVITY_LIMIT, Math.max(1, Math.floor(limit as number)));
}

/**
 * Render a value for one side of a diff. `undefined`/`null`/`""` all collapse to
 * `null` ("not set"), so an optional field that went from absent to blank doesn't
 * read as a change.
 */
export function activityValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) return value.toISOString();
  // A plain object/array reaching here (not expected in practice — activity
  // fields are scalars) would otherwise stringify to the useless
  // "[object Object]" via `String()` — routed through `JSON.stringify` instead;
  // what reaches `String()` below is a scalar.
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  const text = (typeof value === "object" ? JSON.stringify(value) : String(value)).trim();
  return text === "" ? null : text;
}

/**
 * Build a diff from two flat snapshots, keeping only the fields that actually
 * moved.
 *
 * Recording every field of every save would bury the one that changed in thirty
 * that didn't, and the log's job is to answer "what was it before" — a question
 * about the fields someone touched. Field order follows `after`, so an entry reads
 * in the order the form presents it.
 */
export function diffFields(
  before: Readonly<Record<string, unknown>>,
  after: Readonly<Record<string, unknown>>,
): ActivityChange[] {
  const changes: ActivityChange[] = [];
  for (const field of Object.keys(after)) {
    const from = activityValue(before[field]);
    const to = activityValue(after[field]);
    if (from !== to) changes.push({ field, before: from, after: to });
  }
  return changes;
}

/** A one-field diff, for the changes that are a single value moving. */
export function singleChange(field: string, before: unknown, after: unknown): ActivityChange[] {
  return [{ field, before: activityValue(before), after: activityValue(after) }];
}

/**
 * The field names in a diff, for the indexed `changed_fields` column.
 *
 * Denormalized from `changes` rather than queried out of it: Postgres can index a
 * `text[]` with GIN and answer "entries where `price` moved" as an index scan,
 * where the equivalent question asked of the JSON means examining every row's
 * blob. The duplication is contained — the store derives this on write, so the two
 * can't be set independently and drift.
 */
export function changedFields(changes: readonly ActivityChange[]): string[] {
  return [...new Set(changes.map((change) => change.field))];
}

/**
 * The fields the activity page offers as a filter, grouped for the dropdown.
 *
 * A curated subset of everything the log records, not all of it: the filter exists
 * to answer the handful of questions someone actually arrives with — who has been
 * changing prices, stock, discounts, capacity, access — and a dropdown listing all
 * thirty diffable fields answers none of them faster. Anything omitted is still
 * recorded, still visible on the entry, and still reachable via `?field=`.
 */
export const FILTERABLE_ACTIVITY_FIELDS = [
  "price",
  "stockQuantity",
  "isPublished",
  "isActive",
  "status",
  "paymentStatus",
  "role",
] as const;
