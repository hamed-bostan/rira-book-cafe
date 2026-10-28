import type { Order, OrderStatus } from "./Order";

/**
 * The bar display: the live queue as the barista sees it — big cards in two lanes
 * (new, being made), every line of every order. The cafe has no separate kitchen:
 * the bar makes the drinks and hands over the ready-made food, cakes and books with
 * them, so one board shows it all. A served order leaves the board.
 */

export const KITCHEN_LANES = ["new", "making"] as const;
export type KitchenLane = (typeof KITCHEN_LANES)[number];

const LANE_OF: Partial<Record<OrderStatus, KitchenLane>> = {
  pending: "new",
  preparing: "making",
};

/** An order is "late" once it has waited this long since it was placed. */
export const KITCHEN_LATE_MINUTES = 15;

/** From this long an order's wait shows as a warning: not late yet, but getting there. */
export const KITCHEN_WARN_MINUTES = 10;

/** How a wait reads on the board: fine, getting long, or late. */
export type KitchenWaitTone = "neutral" | "warning" | "late";

/** Whole minutes an order has waited at `now`. */
export function minutesWaiting(order: Pick<Order, "placedAt">, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(order.placedAt).getTime()) / 60_000));
}

/** The tone of a wait of `minutes`: neutral, a warning from 10 minutes, late from 15. */
export function kitchenWaitTone(minutes: number): KitchenWaitTone {
  if (minutes >= KITCHEN_LATE_MINUTES) return "late";
  if (minutes >= KITCHEN_WARN_MINUTES) return "warning";
  return "neutral";
}

/** Whether the order has waited past the late mark at `now`. */
export function isLateOrder(order: Pick<Order, "placedAt">, now: Date): boolean {
  return minutesWaiting(order, now) >= KITCHEN_LATE_MINUTES;
}

/** How many of the orders are late at `now` — what a lane flags in red. */
export function lateOrderCount(orders: readonly Pick<Order, "placedAt">[], now: Date): number {
  return orders.filter((order) => isLateOrder(order, now)).length;
}

/** Sort active orders into the board's lanes, oldest first. */
export function kitchenLanes(orders: readonly Order[]): Record<KitchenLane, Order[]> {
  const lanes: Record<KitchenLane, Order[]> = { new: [], making: [] };
  const oldestFirst = [...orders].sort((a, b) => a.placedAt.localeCompare(b.placedAt));
  for (const order of oldestFirst) {
    const lane = LANE_OF[order.status];
    if (lane) lanes[lane].push(order);
  }
  return lanes;
}
