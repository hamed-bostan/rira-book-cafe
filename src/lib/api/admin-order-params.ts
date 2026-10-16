import { z } from "zod";

import { ADMIN_ORDER_STATUS_FILTERS, type AdminOrderFilters } from "@/src/domain/entities/AdminOrderFilters";
import { PAYMENT_STATUSES, SERVICE_TYPES } from "@/src/domain/entities/Order";

import { trimmedTextParamSchema } from "./trimmed-text-param";

/**
 * The single wire contract for the dashboard order list's filters — the screen
 * writes these query params and `GET /api/admin/orders` parses them back.
 * Param names: `q`, `status`, `service`, `payment`.
 */
export const adminOrderFiltersSchema = z.object({
  q: trimmedTextParamSchema,
  status: z.enum(ADMIN_ORDER_STATUS_FILTERS).optional(),
  service: z.enum(SERVICE_TYPES).optional(),
  payment: z.enum(PAYMENT_STATUSES).optional(),
});

/** Parse filters from a `URLSearchParams`; an unknown enum value is a 400, not silently ignored. */
export function parseAdminOrderFilters(params: URLSearchParams): AdminOrderFilters {
  const parsed = adminOrderFiltersSchema.parse(Object.fromEntries(params));
  const filters: AdminOrderFilters = {};
  if (parsed.q) filters.query = parsed.q;
  if (parsed.status) filters.status = parsed.status;
  if (parsed.service) filters.serviceType = parsed.service;
  if (parsed.payment) filters.paymentStatus = parsed.payment;
  return filters;
}
