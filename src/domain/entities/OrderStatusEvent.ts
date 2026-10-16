import type { OrderStatus } from "./Order";

/**
 * One step in an order's history: it moved from one status to another, at a time,
 * because of someone. The detail screen's timeline reads these.
 *
 * Placement is recorded too, as an event with no `from` — so the timeline always
 * starts with when the order came in.
 */
export type OrderStatusEvent = {
  id: string;
  orderId: string;
  /** The status before; `null` for the placement event. */
  from: OrderStatus | null;
  to: OrderStatus;
  /** Who made the change, snapshotted at write time. */
  actorId: string;
  actorName: string;
  /** ISO 8601 timestamp (UTC). */
  at: string;
};
