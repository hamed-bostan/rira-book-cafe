import type { OrderStatus } from "./Order";

/**
 * What a row of the history records:
 * - `status` — the order moved from one status to another;
 * - `changed` — staff changed the order without moving it (a second round, a line
 *   taken off, another table). `from` and `to` are then both the status it stayed in;
 *   what changed is in the activity log.
 */
export const ORDER_EVENT_KINDS = ["status", "changed"] as const;
export type OrderEventKind = (typeof ORDER_EVENT_KINDS)[number];

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
  kind: OrderEventKind;
  /** The status before; `null` for the placement event. */
  from: OrderStatus | null;
  to: OrderStatus;
  /** Who made the change, snapshotted at write time. */
  actorId: string;
  actorName: string;
  /** ISO 8601 timestamp (UTC). */
  at: string;
};
