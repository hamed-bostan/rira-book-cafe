import type {
  ActivityActorOption,
  ActivityEntry,
  ActivityFilters,
  ActivitySort,
  NewActivityEntry,
} from "../entities/ActivityEntry";
import type { Page, PageRequest } from "../entities/Pagination";

/**
 * Read access to the append-only activity log, plus the one narrow write that
 * {@link IActivityLog.recordEvent} documents at the bottom.
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
 * There is no update and no delete, here or anywhere below. A record an admin can
 * quietly tidy up isn't one.
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
   * Record an admin action that *isn't* a change to anything stored — currently
   * only a message sent to a customer about their order.
   *
   * This is the one write on this port, and it is a carve-out rather than a
   * loophole. Everything above argues that an entry must commit inside the
   * transaction of the change it explains; that argument is about entries which
   * *have* a change to be atomic with, and its failure mode is an entry drifting
   * from the row it claims to describe. A sent notification has no row. There is no
   * transaction to join, nothing that can commit without it, and nothing for it to
   * drift from — so the rule it would be breaking doesn't reach it.
   *
   * What that means in practice: every audited *edit* still goes through
   * {@link AuditHook}, and this must never be used to record one. An entry written
   * here is exactly as atomic as the thing it describes — which for an outbound
   * message is not at all, since the send already happened and can't be unsent.
   *
   * Best-effort, like the sends themselves: the implementation swallows and logs a
   * failure rather than throwing. Failing the request after the customer has
   * already been messaged would invite an admin to send it a second time.
   */
  recordEvent(entry: NewActivityEntry): Promise<void>;
};
