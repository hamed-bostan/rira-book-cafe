import type { OrderStatus, PaymentStatus, ServiceType } from "./Order";

/**
 * Filter and sort vocabulary for the dashboard's order list.
 *
 * An empty filter means "every order, paged" — newest first, because the question
 * staff ask of this list is "what just came in".
 */

export const ADMIN_ORDER_SORTS = ["placedAt", "total"] as const;
export type AdminOrderSort = (typeof ADMIN_ORDER_SORTS)[number];

export const DEFAULT_ADMIN_ORDER_SORT: AdminOrderSort = "placedAt";
export const DEFAULT_ADMIN_ORDER_DIRECTION = "desc";

/**
 * The status filter's values: each real status, plus `active` — everything still
 * in the queue — which is what the counter screen shows by default.
 */
export const ADMIN_ORDER_STATUS_FILTERS = ["active", "pending", "preparing", "completed", "cancelled"] as const;
export type AdminOrderStatusFilter = (typeof ADMIN_ORDER_STATUS_FILTERS)[number];

export type AdminOrderFilters = {
  /** Matches the order number exactly, or the table, guest name or phone partially. */
  query?: string;
  status?: AdminOrderStatusFilter;
  serviceType?: ServiceType;
  paymentStatus?: PaymentStatus;
};

/** True when any filter narrows the list — to tell "no orders yet" from "no matches". */
export function hasAdminOrderFilters(filters: AdminOrderFilters): boolean {
  return (
    filters.query != null || filters.status != null || filters.serviceType != null || filters.paymentStatus != null
  );
}

/** How many orders sit in each status — the numbers on the status tabs. */
export type OrderStatusCounts = Record<OrderStatus, number> & { active: number };
