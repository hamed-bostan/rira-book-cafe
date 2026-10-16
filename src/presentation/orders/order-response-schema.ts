import { z } from "zod";

import type { OrderStatusCounts } from "@/src/domain/entities/AdminOrderFilters";
import { ORDER_STATUSES, PAYMENT_STATUSES, SERVICE_TYPES, type Order } from "@/src/domain/entities/Order";
import type { OrderStatusEvent } from "@/src/domain/entities/OrderStatusEvent";
import { PRODUCT_KINDS } from "@/src/domain/entities/Product";

/**
 * What the order endpoints promise to return, validated at the typed-service
 * boundary. Shared by the dashboard and (later) the guest's order screens, which
 * read orders from the same shape.
 */
export const orderResponseSchema = z.object({
  id: z.string(),
  orderNumber: z.number(),
  userId: z.string(),
  customerName: z.string(),
  customerPhone: z.string(),
  status: z.enum(ORDER_STATUSES),
  serviceType: z.enum(SERVICE_TYPES),
  tableLabel: z.string().optional(),
  note: z.string().optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES),
  items: z.array(
    z.object({
      id: z.string(),
      productId: z.string(),
      kind: z.enum(PRODUCT_KINDS),
      name: z.string(),
      imageUrl: z.string(),
      unitPrice: z.number(),
      quantity: z.number(),
      note: z.string().optional(),
    }),
  ),
  subtotal: z.number(),
  total: z.number(),
  placedAt: z.string(),
  updatedAt: z.string(),
}) satisfies z.ZodType<Order>;

export const orderListResponseSchema = z.array(orderResponseSchema);

export const orderStatusEventListResponseSchema = z.array(
  z.object({
    id: z.string(),
    orderId: z.string(),
    from: z.enum(ORDER_STATUSES).nullable(),
    to: z.enum(ORDER_STATUSES),
    actorId: z.string(),
    actorName: z.string(),
    at: z.string(),
  }) satisfies z.ZodType<OrderStatusEvent>,
);

export const orderStatusCountsResponseSchema = z.object({
  active: z.number(),
  pending: z.number(),
  accepted: z.number(),
  preparing: z.number(),
  ready: z.number(),
  completed: z.number(),
  cancelled: z.number(),
}) satisfies z.ZodType<OrderStatusCounts>;
