import { z } from "zod";

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
  quantity: z.number(),
  revenue: z.number(),
});

export const salesReportResponseSchema = z.object({
  range: rangeSchema,
  previousRange: rangeSchema,
  summary: salesSummarySchema,
  previousSummary: salesSummarySchema,
  daily: z.array(z.object({ day: z.string(), revenue: z.number(), orders: z.number() })),
  hourly: z.array(z.object({ hour: z.number(), orders: z.number(), revenue: z.number() })),
  byKind: z.array(z.object({ kind: z.enum(PRODUCT_KINDS), revenue: z.number(), quantity: z.number() })),
  topItems: z.array(topItemSchema),
});

export type SalesReportWire = z.infer<typeof salesReportResponseSchema>;
export type TopItemWire = z.infer<typeof topItemSchema>;

export const paymentReportResponseSchema = z.object({
  range: rangeSchema,
  summary: z.object({
    paidOrders: z.number(),
    paidValue: z.number(),
    unpaidOrders: z.number(),
    unpaidValue: z.number(),
  }),
  byMethod: z.array(z.object({ method: z.enum(PAYMENT_METHODS), orders: z.number(), value: z.number() })),
  unpaid: z.array(
    z.object({
      id: z.string(),
      orderNumber: z.number(),
      serviceType: z.enum(SERVICE_TYPES),
      tableLabel: z.string().optional(),
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
  activeOrders: z.number(),
  todayReservations: z.object({ bookings: z.number(), covers: z.number(), awaitingConfirmation: z.number() }),
  upcomingEvents: z.number(),
});

export type DashboardOverviewWire = z.infer<typeof dashboardOverviewResponseSchema>;
