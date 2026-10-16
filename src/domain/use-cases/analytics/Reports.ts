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

/** Rows in the top-items table. */
export const TOP_ITEMS_LIMIT = 10;
/** Rows in the top-guests table. */
export const TOP_GUESTS_LIMIT = 10;
/** Most unpaid orders listed — enough to chase, not a ledger. */
export const UNPAID_ORDERS_LIMIT = 50;

/** The sales report for a range, compared with the period just before it. */
export class GetSalesReport {
  constructor(private readonly analytics: IAnalyticsRepository) {}

  async execute(range: DateRange, sort: TopItemSort): Promise<SalesReport> {
    const previousRange = previousPeriod(range);
    const [summary, previousSummary, daily, previousDaily, hourly, byKind, byService, topItems] = await Promise.all([
      this.analytics.salesSummary(range),
      this.analytics.salesSummary(previousRange),
      this.analytics.dailySales(range),
      this.analytics.dailySales(previousRange),
      this.analytics.hourlyOrders(range),
      this.analytics.salesByKind(range),
      this.analytics.salesByService(range),
      this.analytics.topItems(range, sort, TOP_ITEMS_LIMIT),
    ]);

    return {
      range,
      previousRange,
      summary,
      previousSummary,
      daily: fillDailySeries(range, daily),
      previousDaily: fillDailySeries(previousRange, previousDaily),
      hourly: fillHourlySeries(hourly),
      byKind,
      byService,
      topItems,
    };
  }
}

/** Paid vs unpaid for a range, and the unpaid orders worth chasing. */
export class GetPaymentReport {
  constructor(private readonly analytics: IAnalyticsRepository) {}

  async execute(range: DateRange): Promise<PaymentReport> {
    const [summary, unpaid] = await Promise.all([
      this.analytics.paymentSummary(range),
      this.analytics.unpaidOrders(range, UNPAID_ORDERS_LIMIT),
    ]);
    return { range, summary, unpaid };
  }
}

/** Guests, bookings and events for a range. */
export class GetGuestReport {
  constructor(private readonly analytics: IAnalyticsRepository) {}

  async execute(range: DateRange): Promise<GuestReport> {
    const [counts, topGuests, reservations, events] = await Promise.all([
      this.analytics.guestCounts(range),
      this.analytics.topGuests(range, TOP_GUESTS_LIMIT),
      this.analytics.reservationStats(range),
      this.analytics.eventStats(range),
    ]);
    return { range, ...counts, topGuests, reservations, events };
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
