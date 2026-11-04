import type {
  ActivityActorOption,
  ActivityEntry,
  ActivityFilters,
  ActivitySort,
  NewActivityEntry,
} from "../entities/ActivityEntry";
import type { Page, PageRequest } from "../entities/Pagination";

/**
 * Read access to the append-only activity log, plus the one narrow delete that
 * {@link IActivityLog.pruneBefore} documents at the bottom.
 *
 * Read-only for every *change*, for the same reason `IStockMovementLog` is:
 * entries are written by the repository methods that make the changes they
 * describe, inside the same transaction. A general `record` here would offer a
 * second, non-atomic way to write the same table — which is exactly the gap that
 * arrangement closes. A log whose entries can drift from the changes they explain
 * is worse than none, because it reads as authoritative without being so.
 *
 * The writes are split across two layers, deliberately, and the split is the whole
 * design:
 *
 *  - **Use-cases decide what to record.** Each audited use-case builds a
 *    `NewActivityEntry` and hands it down as an {@link AuditHook}. That placement
 *    is what makes the log hard to bypass: a route handler is a thin controller
 *    that only calls use-cases, so there is no path from an HTTP request to an
 *    audited change that doesn't pass the code that records it. Logging from the
 *    handlers instead would leave every new endpoint — and every internal caller,
 *    seed script or job — one forgotten line away from a silent change.
 *
 *  - **Repositories decide when it hits the database.** They invoke the hook
 *    inside the transaction they already open for the mutation, so the entry and
 *    the change commit together or neither does. The use-case can't do this
 *    itself: it doesn't know where the transaction boundary is, and an entry
 *    written after the call returned would be one crash away from missing.
 *
 * `IUserRepository.applyRoleChanges` is the same arrangement in its original form
 * — role changes have always ridden in the transaction that moves the role. This
 * generalises it to every audited entity rather than leaving it as the one place
 * that got it right.
 *
 * There is no update, and no delete of chosen entries, here or anywhere below. A
 * record an admin can quietly tidy up isn't one. The only removal is retention —
 * everything older than a cut-off, by policy, recorded in the log itself.
 */
export type IActivityLog = {
  /** One page of the log, newest first, narrowed by `filters`. */
  list(filters: ActivityFilters, page: PageRequest<ActivitySort>): Promise<Page<ActivityEntry>>;

  /**
   * One entity's own history, newest first, capped by `limit` — what the panels on
   * the order and product detail screens read. A thin case of `list`, kept
   * separate because a panel wants "the last N" and has no pager to drive.
   */
  listForEntity(entityType: string, entityId: string, limit: number): Promise<ActivityEntry[]>;

  /**
   * The distinct actors appearing in the log, for the actor filter's dropdown.
   *
   * Read from the log rather than from the team table on purpose: the filter has
   * to offer people who have *since* been removed, because their entries are still
   * there and are exactly what someone reviewing an incident came to find.
   *
   * `visibleEntityTypes` restricts which entries count, for the same reason it
   * does on `list` — a dropdown built over entries the viewer can't read would
   * name people whose only appearance in the log is one of those entries.
   */
  listActors(visibleEntityTypes?: readonly string[]): Promise<ActivityActorOption[]>;

  /**
   * Every entry `filters` matches, newest first, in batches — what the CSV export
   * streams. Keyset-paged, so the thousandth batch costs what the first did.
   */
  entryBatches(filters: ActivityFilters, batchSize: number): AsyncIterable<ActivityEntry[]>;

  /**
   * Retention: delete up to `batchSize` of the oldest entries made before `cutoff`,
   * and — when any went — record `entry(deleted)` in the same transaction, so every
   * prune leaves its own line in the log saying how much went and up to when.
   * Resolves how many were deleted; the caller repeats until it's 0.
   *
   * Not a way to remove chosen entries: there is only a cut-off, it comes from the
   * owner's retention setting, and the background job is the only caller. Batched so
   * a first prune of years of history doesn't hold one long lock on the table.
   */
  pruneBefore(cutoff: Date, batchSize: number, entry: (deleted: number) => NewActivityEntry): Promise<number>;
};
