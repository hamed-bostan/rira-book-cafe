import type { AuditHook } from "./AuditHook";
import type { LedgerHook } from "./ILedgerRepository";
import type { ActivityActor } from "../entities/ActivityEntry";
import type { AdminOrderFilters, AdminOrderSort, OrderStatusCounts } from "../entities/AdminOrderFilters";
import type { Order, OrderItem, OrderStatus, PaymentMethod, PaymentStatus, SettablePaymentStatus } from "../entities/Order";
import type { OrderStatusEvent } from "../entities/OrderStatusEvent";
import type { Page, PageRequest } from "../entities/Pagination";

/** A payment mark: from the status staff saw to the one they chose, and how the guest paid. */
export type PaymentChange = { from: PaymentStatus; to: SettablePaymentStatus; method?: PaymentMethod };

/** An order about to be placed. Id, number, status and timestamps are the repository's to assign. */
export type NewOrder = Omit<
  Order,
  "id" | "orderNumber" | "status" | "paymentStatus" | "paymentMethod" | "placedAt" | "updatedAt" | "items" | "pointsEarned"
> & {
  items: Omit<OrderItem, "id">[];
};

export type IOrderRepository = {
  /**
   * Place an order, all-or-nothing: in one transaction, take each line's units off
   * the shelf (guarded, so two orders can't both take the last slice), insert the
   * order and its lines, and record the placement event. If any line is short,
   * nothing changes and `InsufficientStockError` names what's missing.
   *
   * A promo code's usage limits are re-checked under the code's lock
   * (`ConflictError("PROMO_USED_UP")`), and redeemed points are taken off the
   * guest's balance under theirs (`ConflictError("NOT_ENOUGH_POINTS")`) — so two
   * orders racing for the last use, or the same points, can't both win.
   */
  place(input: NewOrder, placedBy: ActivityActor): Promise<Order>;
  getById(id: string): Promise<Order | null>;
  /** One guest's orders, newest first. */
  listForUser(userId: string): Promise<Order[]>;
  /** One page of the dashboard list, plus the total matching the filters. */
  listPage(filters: AdminOrderFilters, page: PageRequest<AdminOrderSort>): Promise<Page<Order>>;
  /** How many orders sit in each status, unfiltered — the numbers on the status tabs. */
  countByStatus(): Promise<OrderStatusCounts>;
  /**
   * Move an order from `from` to `to`, guarded on `from` so a concurrent change
   * can't be overwritten (the loser gets `InvalidOrderTransitionError`). Writes the
   * status event, the audit entry and the ledger postings in the same
   * transaction; moving to `cancelled` also puts the lines' units back on the
   * shelf, turns a `paid` order `refunded` and gives back the points it spent.
   * Moving to `completed` earns the guest their loyalty points.
   */
  transition(
    id: string,
    from: OrderStatus,
    to: OrderStatus,
    actor: ActivityActor,
    audit?: AuditHook<Order>,
    ledger?: LedgerHook<Order>,
  ): Promise<Order>;
  /**
   * Mark the order paid (with its method) or unpaid, guarded on `change.from` so two
   * staff can't both book the same payment. The audit entry and the ledger postings
   * commit with it; the loser of a race gets `InvalidPaymentChangeError`.
   */
  setPaymentStatus(id: string, change: PaymentChange, audit?: AuditHook<Order>, ledger?: LedgerHook<Order>): Promise<Order>;
  /**
   * Mark one line served (stamped now) or take the mark back, guarded so it only
   * lands while the order is in a serving status. Setting the state a line already
   * has changes nothing. An unknown order or line is `NotFoundError`; an order that
   * moved out of serving meanwhile is a `ConflictError`.
   */
  setItemServed(orderId: string, itemId: string, served: boolean): Promise<Order>;
  /** The order's status history, oldest first — placement, then each change. */
  listStatusEvents(orderId: string): Promise<OrderStatusEvent[]>;
};
