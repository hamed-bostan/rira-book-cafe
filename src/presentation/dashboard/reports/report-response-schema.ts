import { z } from "zod/mini";

import { REFUND_TIMINGS, REVENUE_STREAMS, SALES_BRIDGE_KEYS } from "@/src/domain/entities/Analytics";
import { PAYMENT_METHODS, SERVICE_TYPES } from "@/src/domain/entities/Order";
import { PRODUCT_KINDS } from "@/src/domain/entities/Product";

/**
 * What the report endpoints return. Dates arrive as ISO strings (the domain's
 * `Date`s serialized), so these describe the wire shape and the screens read the
 * inferred `…Wire` types. Only the frontend reads these, so they live with the feature.
 */

const rangeSchema = z.object({ fromDay: z.string(), toDay: z.string(), from: z.string(), to: z.string() });

export type ReportRangeWire = z.infer<typeof rangeSchema>;

const salesSummarySchema = z.object({
  revenue: z.number(),
  grossSales: z.number(),
  promoDiscount: z.number(),
  pointsDiscount: z.number(),
  serviceCharge: z.number(),
  charged: z.number(),
  refunds: z.number(),
  orders: z.number(),
  itemsSold: z.number(),
  averageOrderValue: z.number(),
  cancelledOrders: z.number(),
  cancelledValue: z.number(),
});

const topItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  kind: z.enum(PRODUCT_KINDS),
  /** Its menu category, in the reader's language; `null` once the item is deleted. */
  categoryName: z.nullable(z.string()),
  quantity: z.number(),
  revenue: z.number(),
});

const revenueStreamSchema = z.object({
  stream: z.enum(REVENUE_STREAMS),
  received: z.number(),
  refunded: z.number(),
  revenue: z.number(),
  vat: z.number(),
  revenueExVat: z.number(),
  previousRevenue: z.number(),
});

export type RevenueStreamWire = z.infer<typeof revenueStreamSchema>;

const discountSummarySchema = z.object({
  promoOrders: z.number(),
  promoDiscount: z.number(),
  pointsOrders: z.number(),
  pointsDiscount: z.number(),
  pointsRedeemed: z.number(),
  pointsEarned: z.number(),
});

const bridgeLineSchema = z.object({
  key: z.enum(SALES_BRIDGE_KEYS),
  kind: z.enum(["start", "step", "subtotal", "total"]),
  amount: z.number(),
  previous: z.number(),
});

export type SalesBridgeLineWire = z.infer<typeof bridgeLineSchema>;

export const salesReportResponseSchema = z.object({
  range: rangeSchema,
  previousRange: rangeSchema,
  refunds: z.enum(REFUND_TIMINGS),
  summary: salesSummarySchema,
  previousSummary: salesSummarySchema,
  bridge: z.array(bridgeLineSchema),
  daily: z.array(
    z.object({
      day: z.string(),
      revenue: z.number(),
      orders: z.number(),
      /** Of those completed orders, the ones not yet marked paid, and what they're worth. */
      unpaidOrders: z.number(),
      unpaidValue: z.number(),
    }),
  ),
  hourly: z.array(z.object({ hour: z.number(), orders: z.number(), revenue: z.number() })),
  byKind: z.array(z.object({ kind: z.enum(PRODUCT_KINDS), revenue: z.number(), quantity: z.number() })),
  topItems: z.array(topItemSchema),
  discounts: z.object({
    summary: discountSummarySchema,
    previousSummary: discountSummarySchema,
    byCode: z.array(z.object({ code: z.string(), uses: z.number(), discount: z.number(), revenue: z.number() })),
  }),
  streams: z.array(revenueStreamSchema),
});

export type SalesReportWire = z.infer<typeof salesReportResponseSchema>;
export type TopItemWire = z.infer<typeof topItemSchema>;

const paymentSummarySchema = z.object({
  /** Completed orders' total; `paidValue` is the part of it marked paid. */
  revenue: z.number(),
  paidOrders: z.number(),
  paidValue: z.number(),
  unpaidOrders: z.number(),
  unpaidValue: z.number(),
});

const methodPaymentsSchema = z.object({ method: z.enum(PAYMENT_METHODS), orders: z.number(), value: z.number() });

export type MethodPaymentsWire = z.infer<typeof methodPaymentsSchema>;

export const paymentReportResponseSchema = z.object({
  range: rangeSchema,
  previousRange: rangeSchema,
  refunds: z.enum(REFUND_TIMINGS),
  summary: paymentSummarySchema,
  previousSummary: paymentSummarySchema,
  byMethod: z.array(methodPaymentsSchema),
  previousByMethod: z.array(methodPaymentsSchema),
  streams: z.array(revenueStreamSchema),
  unpaid: z.array(
    z.object({
      id: z.string(),
      orderNumber: z.number(),
      serviceType: z.enum(SERVICE_TYPES),
      tableLabel: z.optional(z.string()),
      total: z.number(),
      placedAt: z.string(),
    }),
  ),
});

export type PaymentReportWire = z.infer<typeof paymentReportResponseSchema>;

export const guestReportResponseSchema = z.object({
  range: rangeSchema,
  previousRange: rangeSchema,
  guests: z.number(),
  previousGuests: z.number(),
  newGuests: z.number(),
  returningGuests: z.number(),
  repeatRate: z.number(),
  topGuests: z.array(
    z.object({ userId: z.string(), name: z.string(), phone: z.string(), orders: z.number(), revenue: z.number() }),
  ),
  reservations: z.object({ total: z.number(), covers: z.number(), noShows: z.number(), noShowRate: z.number() }),
});

export type GuestReportWire = z.infer<typeof guestReportResponseSchema>;

export const dashboardOverviewResponseSchema = z.object({
  today: z.string(),
  todayReservations: z.object({ bookings: z.number(), covers: z.number(), awaitingConfirmation: z.number() }),
  upcomingEvents: z.number(),
});

export type DashboardOverviewWire = z.infer<typeof dashboardOverviewResponseSchema>;
