import {
  buildRevenueStreams,
  dayRange,
  fillDailySeries,
  fillHourlySeries,
  previousPeriod,
  salesBridge,
  type DailySales,
  type DashboardOverview,
  type DateRange,
  type GuestReport,
  type MethodPayments,
  type PaymentReport,
  type PromoCodeUsage,
  type RefundTiming,
  type RevenueStream,
  type SalesReport,
  type TopGuest,
  type TopItem,
  type TopItemSort,
  type UnpaidOrder,
} from "../../entities/Analytics";
import { cafeDayOf, cafeDayRange, shiftCafeDay } from "../../entities/CafeTime";

import type { IAnalyticsRepository } from "../../repositories/IAnalyticsRepository";

/** Best sellers ranked. */
export const TOP_ITEMS_LIMIT = 6;
/** Regulars ranked by spend. */
export const TOP_GUESTS_LIMIT = 5;
/** Most unpaid orders listed — enough to chase, not a ledger. */
export const UNPAID_ORDERS_LIMIT = 50;
/** Promo codes listed on screen; the export has them all. */
export const PROMO_CODES_LIMIT = 10;
/**
 * Most rows a table export carries: every item, guest and code a cafe has in a
 * year fits, and the query stays bounded.
 */
export const EXPORT_ROWS_LIMIT = 5000;

/** What a report is asked for: its days, and when refunds count. */
export type ReportQuery = { range: DateRange; refunds: RefundTiming };

/**
 * The sales report for a range, compared with the period just before it — today
 * against yesterday at the same time (`now`): headline figures and the walk from
 * gross sales to revenue, the series, best sellers (their category in `locale`),
 * discounts, and every revenue stream.
 */
export class GetSalesReport {
  constructor(private readonly analytics: IAnalyticsRepository) {}

  async execute(query: ReportQuery & { sort: TopItemSort }, now: Date, locale?: string): Promise<SalesReport> {
    const { range, refunds, sort } = query;
    const previousRange = previousPeriod(range, now);
    const [
      summary,
      previousSummary,
      daily,
      hourly,
      byKind,
      topItems,
      discounts,
      previousDiscounts,
      byCode,
      streams,
      previousStreams,
    ] = await Promise.all([
      this.analytics.salesSummary(range, refunds),
      this.analytics.salesSummary(previousRange, refunds),
      this.analytics.dailySales(range, refunds),
      this.analytics.hourlySales(range, refunds),
      this.analytics.salesByKind(range, refunds),
      this.analytics.topItems(range, refunds, sort, TOP_ITEMS_LIMIT, locale),
      this.analytics.discountSummary(range),
      this.analytics.discountSummary(previousRange),
      this.analytics.promoCodeUsage(range, PROMO_CODES_LIMIT),
      this.analytics.revenueStreams(range, refunds),
      this.analytics.revenueStreams(previousRange, refunds),
    ]);

    return {
      range,
      previousRange,
      refunds,
      summary,
      previousSummary,
      bridge: salesBridge(summary, previousSummary),
      daily: fillDailySeries(range, daily),
      hourly: fillHourlySeries(hourly),
      byKind,
      topItems,
      discounts: { summary: discounts, previousSummary: previousDiscounts, byCode },
      streams: buildRevenueStreams(streams, previousStreams),
    };
  }
}

/**
 * Paid vs unpaid for a range against the period before, how the paid part came
 * in, the unpaid orders worth chasing, and the VAT inside each revenue stream.
 */
export class GetPaymentReport {
  constructor(private readonly analytics: IAnalyticsRepository) {}

  async execute(query: ReportQuery, now: Date): Promise<PaymentReport> {
    const { range, refunds } = query;
    const previousRange = previousPeriod(range, now);
    const [summary, previousSummary, byMethod, previousByMethod, unpaid, streams, previousStreams] = await Promise.all([
      this.analytics.paymentSummary(range, refunds),
      this.analytics.paymentSummary(previousRange, refunds),
      this.analytics.paidByMethod(range, refunds),
      this.analytics.paidByMethod(previousRange, refunds),
      this.analytics.unpaidOrders(range, UNPAID_ORDERS_LIMIT),
      this.analytics.revenueStreams(range, refunds),
      this.analytics.revenueStreams(previousRange, refunds),
    ]);
    return {
      range,
      previousRange,
      refunds,
      summary,
      previousSummary,
      byMethod,
      previousByMethod,
      unpaid,
      streams: buildRevenueStreams(streams, previousStreams),
    };
  }
}

/** Guests and bookings for a range, with the guest count compared with the period before (today: yesterday at this time). */
export class GetGuestReport {
  constructor(private readonly analytics: IAnalyticsRepository) {}

  async execute(range: DateRange, now: Date): Promise<GuestReport> {
    const previousRange = previousPeriod(range, now);
    const [counts, previousCounts, topGuests, reservations] = await Promise.all([
      this.analytics.guestCounts(range),
      this.analytics.guestCounts(previousRange),
      this.analytics.topGuests(range, TOP_GUESTS_LIMIT),
      this.analytics.reservationStats(range),
    ]);
    return { range, previousRange, ...counts, previousGuests: previousCounts.guests, topGuests, reservations };
  }
}

/** The tables a report can be downloaded as, by the report they sit on. */
export const REPORT_TABLES = [
  "salesByDay",
  "topItems",
  "discounts",
  "streams",
  "paymentsByMethod",
  "unpaidOrders",
  "guests",
] as const;
export type ReportTable = (typeof REPORT_TABLES)[number];

/** A table's rows, whole — not capped to what fits on screen. */
export type ReportTableRows =
  | { table: "salesByDay"; rows: DailySales[] }
  | { table: "topItems"; rows: TopItem[] }
  | { table: "discounts"; rows: PromoCodeUsage[] }
  | { table: "streams"; rows: RevenueStream[] }
  | { table: "paymentsByMethod"; rows: MethodPayments[] }
  | { table: "unpaidOrders"; rows: UnpaidOrder[] }
  | { table: "guests"; rows: TopGuest[] };

/**
 * One of a report's tables in full, for a spreadsheet: the same figures the
 * screen shows (same range, same refund timing), without the on-screen caps.
 */
export class GetReportTable {
  constructor(private readonly analytics: IAnalyticsRepository) {}

  async execute(
    table: ReportTable,
    query: ReportQuery & { sort: TopItemSort },
    now: Date,
    locale?: string,
  ): Promise<ReportTableRows> {
    const { range, refunds, sort } = query;
    switch (table) {
      case "salesByDay":
        return { table, rows: fillDailySeries(range, await this.analytics.dailySales(range, refunds)) };
      case "topItems":
        return { table, rows: await this.analytics.topItems(range, refunds, sort, EXPORT_ROWS_LIMIT, locale) };
      case "discounts":
        return { table, rows: await this.analytics.promoCodeUsage(range, EXPORT_ROWS_LIMIT) };
      case "streams": {
        const [current, previous] = await Promise.all([
          this.analytics.revenueStreams(range, refunds),
          this.analytics.revenueStreams(previousPeriod(range, now), refunds),
        ]);
        return { table, rows: buildRevenueStreams(current, previous) };
      }
      case "paymentsByMethod":
        return { table, rows: await this.analytics.paidByMethod(range, refunds) };
      case "unpaidOrders":
        return { table, rows: await this.analytics.unpaidOrders(range, EXPORT_ROWS_LIMIT) };
      case "guests":
        return { table, rows: await this.analytics.topGuests(range, EXPORT_ROWS_LIMIT) };
    }
  }
}

/** The dashboard's front page, operational half: today's bookings and the week's events. */
export class GetDashboardOverview {
  constructor(private readonly analytics: IAnalyticsRepository) {}

  async execute(now: Date): Promise<DashboardOverview> {
    const today = cafeDayOf(now);
    const nextWeekEnd = cafeDayRange(shiftCafeDay(today, 7)).from;

    const [todayReservations, upcomingEvents] = await Promise.all([
      this.analytics.reservationsOn(dayRange(today, today)),
      this.analytics.publishedEventsDuring(now, nextWeekEnd),
    ]);

    return { today, todayReservations, upcomingEvents };
  }
}
