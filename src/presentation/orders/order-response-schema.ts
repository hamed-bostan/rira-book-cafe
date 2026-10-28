import { z } from "zod/mini";

import type { OrderStatusCounts } from "@/src/domain/entities/AdminOrderFilters";
import {
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  SERVICE_TYPES,
  type Order,
} from "@/src/domain/entities/Order";
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
  tableLabel: z.optional(z.string()),
  note: z.optional(z.string()),
  paymentStatus: z.enum(PAYMENT_STATUSES),
  paymentMethod: z.optional(z.enum(PAYMENT_METHODS)),
  items: z.array(
    z.object({
      id: z.string(),
      productId: z.string(),
      kind: z.enum(PRODUCT_KINDS),
      name: z.string(),
      imageUrl: z.string(),
      unitPrice: z.number(),
      // Staff endpoints only; guest endpoints strip it.
      unitCost: z.optional(z.number()),
      taxExempt: z.optional(z.boolean()),
      stockTracked: z.optional(z.boolean()),
      quantity: z.number(),
      note: z.optional(z.string()),
      servedAt: z.optional(z.string()),
    }),
  ),
  subtotal: z.number(),
  promoCode: z.optional(z.string()),
  promoCodeId: z.optional(z.string()),
  promoDiscount: z.number(),
  pointsRedeemed: z.number(),
  pointsDiscount: z.number(),
  pointsEarned: z.number(),
  total: z.number(),
  placedAt: z.string(),
  updatedAt: z.string(),
}) satisfies z.ZodMiniType<Order>;

export const orderListResponseSchema = z.array(orderResponseSchema);

export const orderStatusEventListResponseSchema = z.array(
  z.object({
    id: z.string(),
    orderId: z.string(),
    from: z.nullable(z.enum(ORDER_STATUSES)),
    to: z.enum(ORDER_STATUSES),
    actorId: z.string(),
    actorName: z.string(),
    at: z.string(),
  }) satisfies z.ZodMiniType<OrderStatusEvent>,
);

export const orderStatusCountsResponseSchema = z.object({
  active: z.number(),
  pending: z.number(),
  preparing: z.number(),
  completed: z.number(),
  cancelled: z.number(),
}) satisfies z.ZodMiniType<OrderStatusCounts>;
