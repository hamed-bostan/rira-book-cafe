import { z } from "zod/mini";

import type { OrderStatusCounts } from "@/src/domain/entities/AdminOrderFilters";
import {
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  SERVICE_TYPES,
  type Order,
} from "@/src/domain/entities/Order";
import type { OrderReceipt } from "@/src/domain/entities/OrderReceipt";
import type { OrderRefund } from "@/src/domain/entities/OrderRefund";
import { ORDER_EVENT_KINDS, type OrderStatusEvent } from "@/src/domain/entities/OrderStatusEvent";
import { PRODUCT_KINDS } from "@/src/domain/entities/Product";

/**
 * What the order endpoints promise to return, validated at the typed-service
 * boundary. Shared by the dashboard and (later) the guest's order screens, which
 * read orders from the same shape.
 */
export const orderResponseSchema = z.object({
  id: z.string(),
  orderNumber: z.number(),
  userId: z.optional(z.string()),
  customerName: z.string(),
  customerPhone: z.string(),
  status: z.enum(ORDER_STATUSES),
  serviceType: z.enum(SERVICE_TYPES),
  tableLabel: z.optional(z.string()),
  note: z.optional(z.string()),
  paymentStatus: z.enum(PAYMENT_STATUSES),
  paymentMethod: z.optional(z.enum(PAYMENT_METHODS)),
  paymentParts: z.optional(z.array(z.object({ method: z.enum(PAYMENT_METHODS), amount: z.number() }))),
  refundedTotal: z.number(),
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
      refundedQuantity: z.optional(z.number()),
      note: z.optional(z.string()),
      options: z.optional(
        z.array(
          z.object({
            groupId: z.string(),
            group: z.string(),
            groupFa: z.optional(z.string()),
            choiceId: z.string(),
            choice: z.string(),
            choiceFa: z.optional(z.string()),
            priceDelta: z.number(),
          }),
        ),
      ),
      servedAt: z.optional(z.string()),
      addedAt: z.optional(z.string()),
    }),
  ),
  subtotal: z.number(),
  promoCode: z.optional(z.string()),
  promoCodeId: z.optional(z.string()),
  promoDiscount: z.number(),
  pointsRedeemed: z.number(),
  pointsDiscount: z.number(),
  pointsEarned: z.number(),
  serviceCharge: z.number(),
  serviceChargeBps: z.number(),
  total: z.number(),
  placedAt: z.string(),
  updatedAt: z.string(),
  changedAt: z.optional(z.string()),
}) satisfies z.ZodMiniType<Order>;

export const orderListResponseSchema = z.array(orderResponseSchema);

export const orderRefundListResponseSchema = z.array(
  z.object({
    id: z.string(),
    number: z.number(),
    orderId: z.string(),
    date: z.string(),
    method: z.enum(PAYMENT_METHODS),
    amount: z.number(),
    vatAmount: z.number(),
    reason: z.optional(z.string()),
    lines: z.array(
      z.object({
        orderItemId: z.string(),
        name: z.string(),
        kind: z.enum(PRODUCT_KINDS),
        quantity: z.number(),
        amount: z.number(),
        vatAmount: z.number(),
        serviceCharge: z.number(),
        serviceChargeVat: z.number(),
        restocked: z.boolean(),
      }),
    ),
    createdById: z.string(),
    createdByName: z.string(),
    createdAt: z.string(),
  }) satisfies z.ZodMiniType<OrderRefund>,
);

export const orderRefundResultResponseSchema = z.object({ order: orderResponseSchema });

export const orderStatusEventListResponseSchema = z.array(
  z.object({
    id: z.string(),
    orderId: z.string(),
    kind: z.enum(ORDER_EVENT_KINDS),
    from: z.nullable(z.enum(ORDER_STATUSES)),
    to: z.enum(ORDER_STATUSES),
    actorId: z.string(),
    actorName: z.string(),
    at: z.string(),
  }) satisfies z.ZodMiniType<OrderStatusEvent>,
);

/** An order's receipt, for staff to print or for the guest whose order it is. */
export const orderReceiptResponseSchema = z.object({
  order: orderResponseSchema,
  payments: z.array(z.object({ method: z.enum(PAYMENT_METHODS), amount: z.number() })),
  refunds: z.array(
    z.object({ number: z.number(), date: z.string(), method: z.enum(PAYMENT_METHODS), amount: z.number() }),
  ),
  vatRateBps: z.number(),
  vatIncluded: z.number(),
}) satisfies z.ZodMiniType<OrderReceipt>;

export const orderStatusCountsResponseSchema = z.object({
  active: z.number(),
  pending: z.number(),
  preparing: z.number(),
  completed: z.number(),
  cancelled: z.number(),
}) satisfies z.ZodMiniType<OrderStatusCounts>;
