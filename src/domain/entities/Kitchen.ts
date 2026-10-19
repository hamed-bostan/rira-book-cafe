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

/** Whole minutes an order has waited at `now`. */
export function minutesWaiting(order: Pick<Order, "placedAt">, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(order.placedAt).getTime()) / 60_000));
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
