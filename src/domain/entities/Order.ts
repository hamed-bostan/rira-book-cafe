import type { ProductKind } from "./Product";

/**
 * A cafe order: what a guest asked for, where it's served, and how far along the
 * counter it has got.
 *
 * There is no delivery. An order is either eaten in at a table or picked up at the
 * counter, and its life is the bar's workflow — taken, made, handed over.
 */

/**
 * Where an order is served:
 * - `dineIn` — brought to a table; the table number is required.
 * - `takeaway` — picked up at the counter.
 */
export const SERVICE_TYPES = ["dineIn", "takeaway"] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

/**
 * The order's place in the workflow, in order:
 * - `pending` — placed, not yet seen by staff. The guest can still cancel it.
 * - `accepted` — staff took it.
 * - `preparing` — on the bar / in the kitchen.
 * - `ready` — waiting at the pass (takeaway) or about to go out (dine-in).
 * - `completed` — served or picked up. Terminal.
 * - `cancelled` — withdrawn by the guest or staff. Terminal; stock goes back.
 */
export const ORDER_STATUSES = ["pending", "accepted", "preparing", "ready", "completed", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Statuses an order is still being worked in — the queue a barista watches. */
export const ACTIVE_ORDER_STATUSES = ["pending", "accepted", "preparing", "ready"] as const satisfies readonly OrderStatus[];

/** Whether the guest has paid. Payment is taken at the counter, so staff mark it. */
export const PAYMENT_STATUSES = ["unpaid", "paid"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Longest table label accepted, e.g. "12" or "Terrace 3". */
export const MAX_TABLE_LABEL_LENGTH = 20;
/** Longest note a guest can attach to an order or a line. */
export const MAX_ORDER_NOTE_TEXT_LENGTH = 300;
/** Most units of one item in a single order line. */
export const MAX_LINE_QUANTITY = 50;

/**
 * One line of an order. Name, kind, image and price are snapshotted at placement,
 * so the order still reads correctly after the menu item is renamed, repriced or
 * deleted.
 */
export type OrderItem = {
  id: string;
  productId: string;
  kind: ProductKind;
  name: string;
  imageUrl: string;
  /** Price per unit in Toman, at the moment the order was placed. */
  unitPrice: number;
  quantity: number;
  /** The guest's request for this line, e.g. "oat milk, no sugar". */
  note?: string;
};

export type Order = {
  id: string;
  /** Short sequential number staff call out ("order 42"). */
  orderNumber: number;
  /** Who placed it. */
  userId: string;
  /** The guest's name and phone, snapshotted at placement so the queue reads without a lookup. */
  customerName: string;
  customerPhone: string;
  status: OrderStatus;
  serviceType: ServiceType;
  /** The table, for dine-in orders only. */
  tableLabel?: string;
  /** A note for the whole order, e.g. "birthday — bring candles with the cake". */
  note?: string;
  paymentStatus: PaymentStatus;
  items: OrderItem[];
  /** Sum of the lines, in Toman. */
  subtotal: number;
  /** What the guest pays, in Toman. Equals the subtotal until promotions and tax land. */
  total: number;
  /** ISO 8601 timestamp (UTC). */
  placedAt: string;
  /** ISO 8601 timestamp (UTC) of the last change. */
  updatedAt: string;
};

/**
 * Which statuses each status may move to. The whole workflow in one table: every
 * transition the API accepts is listed here, and anything else is refused.
 *
 * Cancelling is allowed up to `preparing` and not after: once an order is `ready`
 * it has been made, and withdrawing it is a refund conversation, not a click.
 */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["accepted", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["completed"],
  completed: [],
  cancelled: [],
};

/** Whether an order in `from` may move to `to`. */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** The next step forward in the workflow, or `null` once the order is finished. */
export function nextOrderStatus(status: OrderStatus): OrderStatus | null {
  return TRANSITIONS[status].find((to) => to !== "cancelled") ?? null;
}

/** Whether staff may still cancel the order. */
export function isStaffCancellable(status: OrderStatus): boolean {
  return canTransition(status, "cancelled");
}

/** Whether the guest may still cancel — only before staff have picked it up. */
export function isGuestCancellable(status: OrderStatus): boolean {
  return status === "pending";
}

/** Whether the order is still in the queue (not completed or cancelled). */
export function isActiveOrder(status: OrderStatus): boolean {
  return (ACTIVE_ORDER_STATUSES as readonly OrderStatus[]).includes(status);
}

/** Total units across all lines. */
export function orderItemCount(order: Pick<Order, "items">): number {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

/** The sum of the lines, in Toman. */
export function orderSubtotal(items: readonly Pick<OrderItem, "unitPrice" | "quantity">[]): number {
  return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
}
