import type { AuditHook } from "./AuditHook";
import type { LedgerHook } from "./ILedgerRepository";
import type { ActivityActor } from "../entities/ActivityEntry";
import type { AdminOrderFilters, AdminOrderSort, OrderStatusCounts } from "../entities/AdminOrderFilters";
import type {
  Order,
  OrderItem,
  OrderStatus,
  PaymentPart,
  PaymentStatus,
  ServiceType,
  SettablePaymentStatus,
} from "../entities/Order";
import type { NewOrderRefund, OrderRefund } from "../entities/OrderRefund";
import type { OrderStatusEvent } from "../entities/OrderStatusEvent";
import type { Page, PageRequest } from "../entities/Pagination";

/**
 * A payment mark: from the status staff saw to the one they chose, and how the guest
 * paid. `total`, when given, is the bill the payment was taken for — the mark is
 * refused if the order's total changed since (its lines were changed meanwhile).
 */
export type PaymentChange = {
  from: PaymentStatus;
  to: SettablePaymentStatus;
  parts?: readonly PaymentPart[];
  total?: number;
};

/**
 * A change to an order already placed, as the use-case worked it out: the order as
 * it read it, the lines to lower or take off, the lines to add, where it's served,
 * and — when the lines change — its amounts re-priced.
 */
export type OrderChange = {
  orderId: string;
  /** The order as the change was worked out from; refused if it moved since. */
  expected: Pick<Order, "updatedAt" | "status" | "paymentStatus">;
  /** Lines lowered, by id: from the quantity read to the new one. `0` takes the line off. */
  lower: { itemId: string; from: number; to: number }[];
  /** New lines — a second round — priced from the menu. */
  add: Omit<OrderItem, "id" | "refundedQuantity" | "servedAt" | "addedAt">[];
  serviceType: ServiceType;
  /** The table, for dine-in only. */
  tableLabel?: string;
  /** The order's amounts after the lines change; absent when only the service changes. */
  amounts?: Pick<Order, "subtotal" | "promoDiscount" | "pointsDiscount" | "total">;
};

/** An order about to be placed. Id, number, status and timestamps are the repository's to assign. */
export type NewOrder = Omit<
  Order,
  | "id"
  | "orderNumber"
  | "status"
  | "paymentStatus"
  | "paymentMethod"
  | "paymentParts"
  | "refundedTotal"
  | "placedAt"
  | "updatedAt"
  | "items"
  | "pointsEarned"
  | "changedAt"
> & {
  items: Omit<OrderItem, "id" | "refundedQuantity" | "addedAt">[];
};

/** A refund as it went through: the document, the order after it, and the cost that came back to stock. */
export type OrderRefundResult = { refund: OrderRefund; order: Order; restockedValue: number };

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
  place(input: NewOrder, placedBy: ActivityActor, audit?: AuditHook<Order>): Promise<Order>;
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
   * Mark the order paid (with its parts) or unpaid, guarded on `change.from` so two
   * staff can't both book the same payment. The audit entry and the ledger postings
   * commit with it; the loser of a race gets `InvalidPaymentChangeError`.
   */
  setPaymentStatus(
    id: string,
    change: PaymentChange,
    audit?: AuditHook<Order>,
    ledger?: LedgerHook<Order>,
  ): Promise<Order>;
  /**
   * Hand money back on a completed order, all-or-nothing: under a lock on the order,
   * check no line moved since `input` was priced (`ConflictError("INVALID_TRANSITION")`),
   * record the refund, bump the running totals, put restocked lines back on the shelf
   * and in stock, take back what the refund's share of the order earned in points,
   * and post the audit entry and the ledger entries. Refunding the last of an order
   * turns it `refunded` and gives back the points it spent.
   */
  refund(
    input: NewOrderRefund,
    actor: ActivityActor,
    audit?: AuditHook<OrderRefundResult>,
    ledger?: LedgerHook<OrderRefundResult>,
  ): Promise<OrderRefundResult>;
  /** Refunds on an order, oldest first. */
  listRefunds(orderId: string): Promise<OrderRefund[]>;
  /**
   * Write off a served order nobody paid for: `completed` → `cancelled`, guarded on
   * it still being completed and unpaid (the loser of a race with a payment gets
   * `ConflictError("INVALID_TRANSITION")`). Unlike a cancellation nothing goes back
   * on the shelf — the goods were consumed — and the points it spent stay spent;
   * the points it earned are taken back as far as the guest still has them. Writes
   * the status event, the audit entry and the ledger postings in the same transaction.
   */
  writeOff(id: string, actor: ActivityActor, audit?: AuditHook<Order>, ledger?: LedgerHook<Order>): Promise<Order>;
  /**
   * Mark one line served (stamped now) or take the mark back, guarded so it only
   * lands while the order is in a serving status. Setting the state a line already
   * has changes nothing. An unknown order or line is `NotFoundError`; an order that
   * moved out of serving meanwhile is a `ConflictError`.
   */
  setItemServed(orderId: string, itemId: string, served: boolean): Promise<Order>;
  /**
   * Change an order already placed, all-or-nothing. Under a lock on the order it's
   * refused if the order moved since `change.expected` was read
   * (`ConflictError("INVALID_TRANSITION")`) or a line being lowered went out to the
   * guest meanwhile (`ConflictError("ITEM_SERVED")`). Then it lowers and takes off
   * lines, putting their counted units back on the shelf; adds the new lines,
   * taking theirs with the same guarded decrement placing uses
   * (`InsufficientStockError` when one is short); stores the new amounts, table and
   * service and stamps `changedAt`; and records a `changed` row on the timeline and
   * the audit entry. The books aren't touched: an order whose lines can change is
   * unpaid and unserved, so nothing of it is on them yet.
   */
  change(change: OrderChange, actor: ActivityActor, audit?: AuditHook<Order>): Promise<Order>;
  /** The order's status history, oldest first — placement, then each change. */
  listStatusEvents(orderId: string): Promise<OrderStatusEvent[]>;
};
