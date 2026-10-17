import type { Order, OrderStatus } from "./Order";
import type { ProductKind } from "./Product";

/**
 * The kitchen display: the live queue as the bar and the kitchen see it — big
 * cards in three lanes (new, being made, ready), each showing only the lines that
 * station makes. The bar makes drinks, the kitchen makes food; books are handed
 * over at the counter, so they only show on the combined view.
 */

export const KITCHEN_STATIONS = ["all", "bar", "kitchen"] as const;
export type KitchenStation = (typeof KITCHEN_STATIONS)[number];

const STATION_KINDS: Record<KitchenStation, readonly ProductKind[]> = {
  all: ["drink", "food", "book"],
  bar: ["drink"],
  kitchen: ["food"],
};

export const KITCHEN_LANES = ["new", "making", "ready"] as const;
export type KitchenLane = (typeof KITCHEN_LANES)[number];

const LANE_OF: Partial<Record<OrderStatus, KitchenLane>> = {
  pending: "new",
  accepted: "making",
  preparing: "making",
  ready: "ready",
};

/** An order is "late" once it has waited this long since it was placed. */
export const KITCHEN_LATE_MINUTES = 15;

/** Whole minutes an order has waited at `now`. */
export function minutesWaiting(order: Pick<Order, "placedAt">, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(order.placedAt).getTime()) / 60_000));
}

/**
 * Sort active orders into the board's lanes, oldest first, keeping only the lines
 * the station makes. An order with nothing for this station isn't on its board.
 */
export function kitchenLanes(orders: readonly Order[], station: KitchenStation): Record<KitchenLane, Order[]> {
  const kinds = STATION_KINDS[station];
  const lanes: Record<KitchenLane, Order[]> = { new: [], making: [], ready: [] };
  const oldestFirst = [...orders].sort((a, b) => a.placedAt.localeCompare(b.placedAt));
  for (const order of oldestFirst) {
    const lane = LANE_OF[order.status];
    if (!lane) continue;
    const items = order.items.filter((item) => kinds.includes(item.kind));
    if (items.length === 0) continue;
    lanes[lane].push({ ...order, items });
  }
  return lanes;
}
