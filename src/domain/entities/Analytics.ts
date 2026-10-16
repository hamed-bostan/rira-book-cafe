import { cafeDayOf, cafeDayRange, shiftCafeDay } from "./CafeTime";

import type { OrderStatus, ServiceType } from "./Order";
import type { ProductKind } from "./Product";

/**
 * The cafe's numbers, as the reports read them.
 *
 * Revenue is counted from **completed** orders — served or picked up — because
 * that is when the cafe actually delivered what it charged for. Placed-but-open
 * orders are the queue, not sales; cancelled orders are tracked separately so a
 * bad day of cancellations shows up instead of quietly shrinking revenue.
 *
 * Every range is a set of whole cafe days (Tehran calendar), `[from, to)`.
 */

export const ANALYTICS_RANGE_PRESETS = ["today", "7d", "30d", "90d"] as const;
export type AnalyticsRangePreset = (typeof ANALYTICS_RANGE_PRESETS)[number];
export const DEFAULT_ANALYTICS_PRESET: AnalyticsRangePreset = "30d";

/** Longest custom range a report accepts — keeps the day series and SQL bounded. */
export const MAX_RANGE_DAYS = 366;

/** A span of whole cafe days: `fromDay` and `toDay` inclusive (`YYYY-MM-DD`), and the UTC instants they cover. */
export type DateRange = {
  fromDay: string;
  toDay: string;
  /** Start of `fromDay`, inclusive. */
  from: Date;
  /** Start of the day after `toDay`, exclusive. */
  to: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** The range covering `fromDay`..`toDay` inclusive. */
export function dayRange(fromDay: string, toDay: string): DateRange {
  return { fromDay, toDay, from: cafeDayRange(fromDay).from, to: cafeDayRange(toDay).to };
}

/** How many cafe days a range spans. */
export function rangeDays(range: DateRange): number {
  return Math.round((range.to.getTime() - range.from.getTime()) / DAY_MS);
}

/** A preset ending today (inclusive), on the cafe calendar. */
export function presetRange(preset: AnalyticsRangePreset, now: Date): DateRange {
  const today = cafeDayOf(now);
  const days = preset === "today" ? 1 : Number(preset.replace("d", ""));
  return dayRange(shiftCafeDay(today, -(days - 1)), today);
}

/** The same number of days immediately before `range` — what "vs previous period" compares against. */
export function previousPeriod(range: DateRange): DateRange {
  const days = rangeDays(range);
  return dayRange(shiftCafeDay(range.fromDay, -days), shiftCafeDay(range.fromDay, -1));
}

/** Every cafe day in a range, in order — the x-axis of the daily series. */
export function daysOf(range: DateRange): string[] {
  const days: string[] = [];
  for (let day = range.fromDay; day <= range.toDay; day = shiftCafeDay(day, 1)) days.push(day);
  return days;
}

/** Headline sales numbers for one range. */
export type SalesSummary = {
  /** Sum of completed orders' totals, Toman. */
  revenue: number;
  /** Completed orders. */
  orders: number;
  /** Units sold across completed orders. */
  itemsSold: number;
  /** `revenue / orders`, 0 when there were none. */
  averageOrderValue: number;
  /** Orders cancelled in the range, and what they'd have been worth. */
  cancelledOrders: number;
  cancelledValue: number;
};

/** One cafe day's completed sales. */
export type DailySales = { day: string; revenue: number; orders: number };

/** Completed orders by the hour they were placed (cafe clock, 0–23). */
export type HourlyOrders = { hour: number; orders: number };

/** Revenue split by what was sold. */
export type KindSales = { kind: ProductKind; revenue: number; quantity: number };

/** Revenue split by how it was served. */
export type ServiceSales = { serviceType: ServiceType; revenue: number; orders: number };

/** One menu item's performance in the range. */
export type TopItem = { productId: string; name: string; kind: ProductKind; quantity: number; revenue: number };

export const TOP_ITEM_SORTS = ["revenue", "quantity"] as const;
export type TopItemSort = (typeof TOP_ITEM_SORTS)[number];

/** Everything the sales report draws. */
export type SalesReport = {
  range: DateRange;
  previousRange: DateRange;
  summary: SalesSummary;
  previousSummary: SalesSummary;
  daily: DailySales[];
  previousDaily: DailySales[];
  hourly: HourlyOrders[];
  byKind: KindSales[];
  byService: ServiceSales[];
  topItems: TopItem[];
};

/** Payment status across non-cancelled orders in a range. */
export type PaymentSummary = {
  paidOrders: number;
  paidValue: number;
  unpaidOrders: number;
  unpaidValue: number;
};

/** An order that was served but not marked paid — money to chase. */
export type UnpaidOrder = {
  id: string;
  orderNumber: number;
  customerName: string;
  status: OrderStatus;
  total: number;
  placedAt: string;
};

export type PaymentReport = {
  range: DateRange;
  summary: PaymentSummary;
  /** Completed or ready orders still unpaid, oldest first. */
  unpaid: UnpaidOrder[];
};

/** A guest ranked by spend in the range. */
export type TopGuest = { userId: string; name: string; phone: string; orders: number; revenue: number };

/** Who came, how often, and how they booked. */
export type GuestReport = {
  range: DateRange;
  /** Guests with at least one completed order in the range. */
  guests: number;
  /** …of whom this was their first completed order ever. */
  newGuests: number;
  /** …who had ordered before the range began. */
  returningGuests: number;
  /** Share of guests with two or more completed orders in the range, 0–1. */
  repeatRate: number;
  topGuests: TopGuest[];
  reservations: {
    /** Bookings starting in the range, excluding cancelled. */
    total: number;
    /** Guests across those bookings. */
    covers: number;
    noShows: number;
    /** `noShows / (completed + seated + noShows)`, 0 when none resolved. */
    noShowRate: number;
  };
  events: {
    /** Published events starting in the range. */
    held: number;
    /** Active sign-ups (seats) for them. */
    seatsTaken: number;
  };
};

/**
 * The dashboard overview's operational half: what the floor needs right now.
 * Deliberately money-free — every dashboard role sees it; revenue comes from the
 * sales report, which needs `reports.view`.
 */
export type DashboardOverview = {
  today: string;
  /** Orders still in the queue right now. */
  activeOrders: number;
  todayReservations: { bookings: number; covers: number; awaitingConfirmation: number };
  /** Published events in the next 7 days. */
  upcomingEvents: number;
};

/** Relative change from `previous` to `current`, or `null` when there's no baseline. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / previous;
}

/** Fill gaps so the series has one point per day of the range (days with no sales read 0). */
export function fillDailySeries(range: DateRange, rows: readonly DailySales[]): DailySales[] {
  const byDay = new Map(rows.map((row) => [row.day, row]));
  return daysOf(range).map((day) => byDay.get(day) ?? { day, revenue: 0, orders: 0 });
}

/** One point per hour 0–23, filled. */
export function fillHourlySeries(rows: readonly HourlyOrders[]): HourlyOrders[] {
  const byHour = new Map(rows.map((row) => [row.hour, row.orders]));
  return Array.from({ length: 24 }, (_, hour) => ({ hour, orders: byHour.get(hour) ?? 0 }));
}
