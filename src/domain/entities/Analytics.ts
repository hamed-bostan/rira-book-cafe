import { cafeDayOf, cafeDayRange, shiftCafeDay } from "./CafeTime";

import type { PaymentMethod, ServiceType } from "./Order";
import type { ProductKind } from "./Product";

/**
 * The cafe's numbers, as the reports read them.
 *
 * Revenue is counted from **completed** orders — served or picked up — because
 * that is when the cafe actually delivered what it charged for. Placed-but-open
 * orders are the queue, not sales; cancelled orders are tracked separately so a
 * bad day of cancellations shows up instead of quietly shrinking revenue.
 *
 * Every range is a set of whole cafe days (Tehran calendar), `[from, to)` — save
 * one: yesterday, compared with today while it's still going, stops at the time
 * it is now.
 */

export const ANALYTICS_RANGE_PRESETS = ["today", "7d", "30d", "90d"] as const;
export type AnalyticsRangePreset = (typeof ANALYTICS_RANGE_PRESETS)[number];
export const DEFAULT_ANALYTICS_PRESET: AnalyticsRangePreset = "7d";

/** Longest custom range a report accepts — keeps the day series and SQL bounded. */
export const MAX_RANGE_DAYS = 366;

/** A span of whole cafe days: `fromDay` and `toDay` inclusive (`YYYY-MM-DD`), and the UTC instants they cover. */
export type DateRange = {
  fromDay: string;
  toDay: string;
  /** Start of `fromDay`, inclusive. */
  from: Date;
  /**
   * Exclusive: the start of the day after `toDay` — or, for a day compared with
   * one still in progress, the same moment on that day's clock (see `previousPeriod`).
   */
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

/**
 * The same number of days immediately before `range` — what "vs previous period"
 * compares against. A single day that is still going (today, at `now`) is compared
 * with the day before **up to the same time on the cafe clock** — "yesterday at
 * this time" — so a morning isn't measured against a whole day. Longer ranges
 * compare whole days.
 */
export function previousPeriod(range: DateRange, now: Date): DateRange {
  const days = rangeDays(range);
  const previous = dayRange(shiftCafeDay(range.fromDay, -days), shiftCafeDay(range.fromDay, -1));
  if (days !== 1 || range.toDay !== cafeDayOf(now)) return previous;
  const elapsed = now.getTime() - range.from.getTime();
  return { ...previous, to: new Date(previous.from.getTime() + elapsed) };
}

/** Whether a range stops before the end of its last day — a day compared "at this time". */
export function endsBeforeDayEnd(range: Pick<DateRange, "toDay" | "to">): boolean {
  return range.to.getTime() < cafeDayRange(range.toDay).to.getTime();
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

/** Completed orders, and what they took, by the hour they were placed (cafe clock, 0–23). */
export type HourlySales = { hour: number; orders: number; revenue: number };

/** Revenue split by what was sold. */
export type KindSales = { kind: ProductKind; revenue: number; quantity: number };

/** One menu item's performance in the range. */
export type TopItem = {
  productId: string;
  name: string;
  kind: ProductKind;
  /** The menu category it sits in now, in the reader's language; `null` once the item is deleted. */
  categoryName: string | null;
  quantity: number;
  revenue: number;
};

export const TOP_ITEM_SORTS = ["revenue", "quantity"] as const;
export type TopItemSort = (typeof TOP_ITEM_SORTS)[number];

/** Everything the sales report draws. */
export type SalesReport = {
  range: DateRange;
  previousRange: DateRange;
  summary: SalesSummary;
  previousSummary: SalesSummary;
  daily: DailySales[];
  hourly: HourlySales[];
  byKind: KindSales[];
  topItems: TopItem[];
};

/**
 * How much of the range's money came in, and how much is still owed.
 *
 * `paidValue` is the part of `revenue` (completed orders) marked paid — the
 * "Paid by" split adds up to it. `unpaidValue` is everything served and not yet
 * paid: completed orders, and ready ones (every line out, the order not yet
 * closed), which only count as revenue once completed. So `paidValue +
 * unpaidValue` is `revenue` plus what the unpaid ready orders are worth.
 */
export type PaymentSummary = {
  /** Completed orders' total — the sales report's revenue. */
  revenue: number;
  /** Completed orders marked paid. */
  paidOrders: number;
  paidValue: number;
  /** Ready or completed orders not yet marked paid — the money to chase. */
  unpaidOrders: number;
  unpaidValue: number;
};

/** What the range's paid, completed orders came in as, by payment method. */
export type MethodPayments = { method: PaymentMethod; orders: number; value: number };

/** An order that was served — ready or completed — but not marked paid: money to chase. */
export type UnpaidOrder = {
  id: string;
  orderNumber: number;
  /** Where it was served: at a table, or over the counter. */
  serviceType: ServiceType;
  tableLabel?: string;
  total: number;
  placedAt: string;
};

export type PaymentReport = {
  range: DateRange;
  /** The period before, named beside the range as on the other reports; the payment figures themselves don't compare. */
  previousRange: DateRange;
  summary: PaymentSummary;
  /** Paid completed orders by method; a method nobody paid with is left out. */
  byMethod: MethodPayments[];
  /** Ready or completed orders still unpaid, oldest first. */
  unpaid: UnpaidOrder[];
};

/** A guest ranked by spend in the range. */
export type TopGuest = { userId: string; name: string; phone: string; orders: number; revenue: number };

/** Who came, how often, and how they booked. */
export type GuestReport = {
  range: DateRange;
  previousRange: DateRange;
  /** Guests with at least one completed order in the range. */
  guests: number;
  /** …and in the period just before it, to compare with. */
  previousGuests: number;
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
export function fillHourlySeries(rows: readonly HourlySales[]): HourlySales[] {
  const byHour = new Map(rows.map((row) => [row.hour, row]));
  return Array.from({ length: 24 }, (_, hour) => byHour.get(hour) ?? { hour, orders: 0, revenue: 0 });
}
