import {
  dayRange,
  fillDailySeries,
  fillHourlySeries,
  previousPeriod,
  type DashboardOverview,
  type DateRange,
  type GuestReport,
  type PaymentReport,
  type SalesReport,
  type TopItemSort,
} from "../../entities/Analytics";
import { cafeDayOf, cafeDayRange, shiftCafeDay } from "../../entities/CafeTime";

import type { IAnalyticsRepository } from "../../repositories/IAnalyticsRepository";

/** Best sellers ranked. */
export const TOP_ITEMS_LIMIT = 6;
/** Regulars ranked by spend. */
export const TOP_GUESTS_LIMIT = 5;
/** Most unpaid orders listed — enough to chase, not a ledger. */
export const UNPAID_ORDERS_LIMIT = 50;

/**
 * The sales report for a range, compared with the period just before it — today
 * against yesterday at the same time (`now`). Best sellers name their category in
 * `locale`.
 */
export class GetSalesReport {
  constructor(private readonly analytics: IAnalyticsRepository) {}

  async execute(range: DateRange, sort: TopItemSort, now: Date, locale?: string): Promise<SalesReport> {
    const previousRange = previousPeriod(range, now);
    const [summary, previousSummary, daily, hourly, byKind, topItems] = await Promise.all([
      this.analytics.salesSummary(range),
      this.analytics.salesSummary(previousRange),
      this.analytics.dailySales(range),
      this.analytics.hourlySales(range),
      this.analytics.salesByKind(range),
      this.analytics.topItems(range, sort, TOP_ITEMS_LIMIT, locale),
    ]);

    return {
      range,
      previousRange,
      summary,
      previousSummary,
      daily: fillDailySeries(range, daily),
      hourly: fillHourlySeries(hourly),
      byKind,
      topItems,
    };
  }
}

/**
 * Paid vs unpaid for a range, how the paid part came in, and the unpaid orders
 * worth chasing. The period before is only named, as on the other reports.
 */
export class GetPaymentReport {
  constructor(private readonly analytics: IAnalyticsRepository) {}

  async execute(range: DateRange, now: Date): Promise<PaymentReport> {
    const [summary, byMethod, unpaid] = await Promise.all([
      this.analytics.paymentSummary(range),
      this.analytics.paidByMethod(range),
      this.analytics.unpaidOrders(range, UNPAID_ORDERS_LIMIT),
    ]);
    return { range, previousRange: previousPeriod(range, now), summary, byMethod, unpaid };
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

/** The dashboard's front page, operational half: the queue, today's bookings, the week's events. */
export class GetDashboardOverview {
  constructor(private readonly analytics: IAnalyticsRepository) {}

  async execute(now: Date): Promise<DashboardOverview> {
    const today = cafeDayOf(now);
    const nextWeekEnd = cafeDayRange(shiftCafeDay(today, 7)).from;

    const [activeOrders, todayReservations, upcomingEvents] = await Promise.all([
      this.analytics.activeOrderCount(),
      this.analytics.reservationsOn(dayRange(today, today)),
      this.analytics.publishedEventsBetween(now, nextWeekEnd),
    ]);

    return { today, activeOrders, todayReservations, upcomingEvents };
  }
}
