import { cafeDayOf, cafeDayRange, shiftCafeDay } from "./CafeTime";
import { jalaliMonthDays, toJalali } from "./JalaliCalendar";
import { allocate } from "./Ledger";

import type { PaymentMethod, PaymentPart, ServiceType } from "./Order";
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

/** Rolling presets — a number of days ending today. */
export const ANALYTICS_RANGE_PRESETS = ["today", "7d", "30d", "90d"] as const;
export type AnalyticsRangePreset = (typeof ANALYTICS_RANGE_PRESETS)[number];
export const DEFAULT_ANALYTICS_PRESET: AnalyticsRangePreset = "7d";

/**
 * Calendar presets, on the viewer's calendar: the week so far (weeks start on
 * Saturday, as in Iran), the month so far, and the whole month before. A Persian
 * reader's month is the Jalali one (1 Mehr – 30 Mehr); an English reader's is the
 * Gregorian one. The URL carries the preset's name, so a shared link means "this
 * month" to whoever opens it.
 */
export const CALENDAR_RANGE_PRESETS = ["week", "month", "lastMonth"] as const;
export type CalendarRangePreset = (typeof CALENDAR_RANGE_PRESETS)[number];

/** Every preset a report's `?range=` accepts. */
export const REPORT_RANGE_PRESETS = [...ANALYTICS_RANGE_PRESETS, ...CALENDAR_RANGE_PRESETS] as const;
export type ReportRangePreset = (typeof REPORT_RANGE_PRESETS)[number];

/** Which calendar the month presets follow. */
export type ReportCalendar = "jalali" | "gregorian";

/** Persian readers keep the Jalali calendar; everyone else the Gregorian one. */
export function calendarForLocale(locale: string | undefined): ReportCalendar {
  return locale === "fa" ? "jalali" : "gregorian";
}

/**
 * When a refund on a completed order counts:
 * - `orderDay` — against the day the order was placed, so a day's revenue is what
 *   that day's orders finally came to. The default.
 * - `refundDay` — on the day the money went back, as the books (and the till) see
 *   it: an earlier period's figures stay as they were, and the period the refund
 *   falls in carries it.
 */
export const REFUND_TIMINGS = ["orderDay", "refundDay"] as const;
export type RefundTiming = (typeof REFUND_TIMINGS)[number];
export const DEFAULT_REFUND_TIMING: RefundTiming = "orderDay";

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

/**
 * A preset's days on the cafe calendar. Rolling presets end today (inclusive); the
 * week and the month run from their first day to today; last month is whole.
 */
export function presetRange(preset: ReportRangePreset, now: Date, calendar: ReportCalendar = "gregorian"): DateRange {
  const today = cafeDayOf(now);
  switch (preset) {
    case "week":
      return dayRange(weekStart(today), today);
    case "month":
      return dayRange(monthOf(today, calendar).fromDay, today);
    case "lastMonth": {
      const previous = monthOf(shiftCafeDay(monthOf(today, calendar).fromDay, -1), calendar);
      return dayRange(previous.fromDay, previous.toDay);
    }
    default: {
      const days = preset === "today" ? 1 : Number(preset.replace("d", ""));
      return dayRange(shiftCafeDay(today, -(days - 1)), today);
    }
  }
}

/** JavaScript's day number for Saturday, the first day of the week in Iran. */
const SATURDAY = 6;

/** The Saturday on or before `day`. */
export function weekStart(day: string): string {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return shiftCafeDay(day, -((weekday - SATURDAY + 7) % 7));
}

/** The month `day` falls in, on `calendar`, as an inclusive span of cafe days. */
export function monthOf(day: string, calendar: ReportCalendar): { fromDay: string; toDay: string } {
  if (calendar === "jalali") {
    const { jy, jm } = toJalali(day);
    return jalaliMonthDays(jy, jm);
  }
  const [year, month] = day.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const prefix = day.slice(0, 8);
  return { fromDay: `${prefix}01`, toDay: `${prefix}${String(last).padStart(2, "0")}` };
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
  /** What completed orders came to after refunds (`charged − refunds`), Toman. */
  revenue: number;
  /** Completed orders' lines at list price — before any discount. */
  grossSales: number;
  /** Taken off those orders by promo codes. */
  promoDiscount: number;
  /** Taken off those orders by loyalty points. */
  pointsDiscount: number;
  /** Completed orders' totals — what guests were charged. */
  charged: number;
  /** Refunds on completed orders counted in the range — see `RefundTiming` for which. */
  refunds: number;
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

/**
 * One cafe day's completed sales, and how many of those orders — and how much of
 * that revenue — are still waiting to be marked paid.
 */
export type DailySales = { day: string; revenue: number; orders: number; unpaidOrders: number; unpaidValue: number };

/** Completed orders, and what they took, by the hour they were placed (cafe clock, 0–23). */
export type HourlySales = { hour: number; orders: number; revenue: number };

/**
 * Revenue split by what was sold. Each line's revenue is its share of what the
 * guest actually paid — the order's total (promo and points already off) split
 * over its lines by list value, the same split a refund prices lines with — less
 * what was refunded on it. So the kinds add up to `SalesSummary.revenue` exactly.
 */
export type KindSales = { kind: ProductKind; revenue: number; quantity: number };

/** One menu item's performance in the range. */
export type TopItem = {
  productId: string;
  name: string;
  kind: ProductKind;
  /** The menu category it sits in now, in the reader's language; `null` once the item is deleted. */
  categoryName: string | null;
  /** Units sold, less units refunded. */
  quantity: number;
  /** What it brought in after discounts and refunds, as in `KindSales`. */
  revenue: number;
};

export const TOP_ITEM_SORTS = ["revenue", "quantity"] as const;
export type TopItemSort = (typeof TOP_ITEM_SORTS)[number];

/**
 * One line of the walk from gross sales to net revenue:
 * - `start` — gross sales, the lines at list price;
 * - `step` — something added or taken off (negative when taken off);
 * - `subtotal` — what guests were charged, after discounts;
 * - `total` — net revenue, the report's headline figure.
 */
export type SalesBridgeLine = {
  key: SalesBridgeKey;
  kind: "start" | "step" | "subtotal" | "total";
  amount: number;
  /** The same line for the period before. */
  previous: number;
};

export const SALES_BRIDGE_KEYS = [
  "grossSales",
  "promoDiscount",
  "pointsDiscount",
  "otherAdjustments",
  "charged",
  "refunds",
  "revenue",
] as const;
export type SalesBridgeKey = (typeof SALES_BRIDGE_KEYS)[number];

type BridgeTotals = Pick<SalesSummary, "grossSales" | "promoDiscount" | "pointsDiscount" | "charged" | "refunds">;

/**
 * Gross sales → discounts → refunds → net revenue, against the period before.
 * Every amount an order's total is made of has its own line here, and this is the
 * one place a new one goes: a service charge added on top of the subtotal becomes
 * a `step` after the discounts (and a column summed in `salesSummary`).
 *
 * `otherAdjustments` is whatever the totals hold that no named line explains —
 * zero today, since an order's total is its subtotal less the promo and the points.
 * It only shows when it isn't, so the walk always lands on the revenue to the Toman
 * instead of hiding a difference.
 */
export function salesBridge(current: BridgeTotals, previous: BridgeTotals): SalesBridgeLine[] {
  const unexplained = (totals: BridgeTotals): number =>
    totals.charged - (totals.grossSales - totals.promoDiscount - totals.pointsDiscount);
  const line = (
    key: SalesBridgeKey,
    kind: SalesBridgeLine["kind"],
    amountOf: (totals: BridgeTotals) => number,
  ): SalesBridgeLine => ({ key, kind, amount: amountOf(current), previous: amountOf(previous) });

  const lines = [
    line("grossSales", "start", (totals) => totals.grossSales),
    line("promoDiscount", "step", (totals) => -totals.promoDiscount),
    line("pointsDiscount", "step", (totals) => -totals.pointsDiscount),
    line("otherAdjustments", "step", unexplained),
    line("charged", "subtotal", (totals) => totals.charged),
    line("refunds", "step", (totals) => -totals.refunds),
    line("revenue", "total", (totals) => totals.charged - totals.refunds),
  ];
  return lines.filter((entry) => entry.key !== "otherAdjustments" || entry.amount !== 0 || entry.previous !== 0);
}

/** What promo codes and loyalty points took off the range's completed orders, and the points they moved. */
export type DiscountSummary = {
  /** Completed orders that used a promo code, and what the codes took off them. */
  promoOrders: number;
  promoDiscount: number;
  /** Completed orders paid partly in points, and what the points took off them. */
  pointsOrders: number;
  pointsDiscount: number;
  /** Points spent on those orders. */
  pointsRedeemed: number;
  /** Points guests earned on the range's completed orders. */
  pointsEarned: number;
};

/** One promo code's use in the range. */
export type PromoCodeUsage = {
  /** As it was typed on the orders (stored upper-case). */
  code: string;
  /** Completed orders it was used on. */
  uses: number;
  /** What it took off them. */
  discount: number;
  /** What those orders came to — after every discount, less what was refunded on them. */
  revenue: number;
};

export type DiscountReport = {
  summary: DiscountSummary;
  previousSummary: DiscountSummary;
  /** Every code used in the range, the one that gave most away first. */
  byCode: PromoCodeUsage[];
};

/**
 * Where the cafe's money comes from — every stream the books carry as revenue:
 * - `cafe` — completed orders (drinks, food, books);
 * - `suite` — payments taken for suite stays;
 * - `events` — payments taken for event sign-ups;
 * - `tableDeposits` — table-booking deposits the cafe kept (a no-show, a late cancellation);
 * - `bookDeposits` — deposits kept on books lent and lost (lending charges no fee);
 * - `otherIncome` — payments recorded with no booking behind them (a room hire, bank interest).
 *
 * A deposit is never part of an order: kept, it is its own income; handed back, it
 * was never the cafe's. So nothing here is counted twice.
 */
export const REVENUE_STREAMS = ["cafe", "suite", "events", "tableDeposits", "bookDeposits", "otherIncome"] as const;
export type RevenueStreamKey = (typeof REVENUE_STREAMS)[number];

/** One stream's money in a range, as the repository reads it. All VAT-inclusive, in Toman. */
export type StreamTotals = {
  stream: RevenueStreamKey;
  /** Taken in the range: completed orders' totals, payments received, deposits kept. */
  received: number;
  /** Handed back, counted per `RefundTiming`. */
  refunded: number;
  /** The VAT inside `received`, as each sale or payment booked it. */
  vat: number;
  /** The VAT inside `refunded`. */
  vatRefunded: number;
};

/** One stream on the report. */
export type RevenueStream = {
  stream: RevenueStreamKey;
  received: number;
  refunded: number;
  /** `received − refunded`: what the stream brought in. */
  revenue: number;
  /** The VAT inside `revenue` — owed to the tax office, not the cafe's. */
  vat: number;
  /** `revenue − vat` — what the profit and loss statement shows for the stream. */
  revenueExVat: number;
  /** `revenue` for the period before. */
  previousRevenue: number;
};

/** Every stream in its fixed order (one with no money reads 0), with the period before beside it. */
export function buildRevenueStreams(
  current: readonly StreamTotals[],
  previous: readonly StreamTotals[],
): RevenueStream[] {
  const find = (rows: readonly StreamTotals[], stream: RevenueStreamKey): StreamTotals =>
    rows.find((row) => row.stream === stream) ?? { stream, received: 0, refunded: 0, vat: 0, vatRefunded: 0 };
  return REVENUE_STREAMS.map((stream) => {
    const now = find(current, stream);
    const before = find(previous, stream);
    const revenue = now.received - now.refunded;
    const vat = now.vat - now.vatRefunded;
    return {
      stream,
      received: now.received,
      refunded: now.refunded,
      revenue,
      vat,
      revenueExVat: revenue - vat,
      previousRevenue: before.received - before.refunded,
    };
  });
}

/** Everything the sales report draws. */
export type SalesReport = {
  range: DateRange;
  previousRange: DateRange;
  refunds: RefundTiming;
  summary: SalesSummary;
  previousSummary: SalesSummary;
  /** Gross sales down to net revenue. */
  bridge: SalesBridgeLine[];
  daily: DailySales[];
  hourly: HourlySales[];
  byKind: KindSales[];
  topItems: TopItem[];
  discounts: DiscountReport;
  /** Every revenue stream, the cafe's orders first. */
  streams: RevenueStream[];
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

/**
 * What the range's paid, completed orders came in as, by payment method — net of
 * what was refunded since (see `netPaymentParts`), so the methods add up to
 * `PaymentSummary.paidValue`. `orders` counts the orders with a part paid that way.
 * Counting refunds on the day they happened, each refund comes off the method it
 * went back by instead, so a method can read below zero in a period of refunds.
 */
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
  /** The period before, which the paid figures are compared with. */
  previousRange: DateRange;
  refunds: RefundTiming;
  summary: PaymentSummary;
  previousSummary: PaymentSummary;
  /** Paid completed orders by method; a method nobody paid with is left out. */
  byMethod: MethodPayments[];
  previousByMethod: MethodPayments[];
  /** Ready or completed orders still unpaid, oldest first. */
  unpaid: UnpaidOrder[];
  /** Every revenue stream with the VAT inside it — the period's VAT split. */
  streams: RevenueStream[];
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
  /** Every booking the day counts (`DAY_BOOKING_STATUSES`), finished ones included. */
  todayReservations: { bookings: number; covers: number; awaitingConfirmation: number };
  /** Published events on now or in the next 7 days — one already under way counts until it ends. */
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
  return daysOf(range).map((day) => byDay.get(day) ?? { day, revenue: 0, orders: 0, unpaidOrders: 0, unpaidValue: 0 });
}

/** One point per hour 0–23, filled. */
export function fillHourlySeries(rows: readonly HourlySales[]): HourlySales[] {
  const byHour = new Map(rows.map((row) => [row.hour, row]));
  return Array.from({ length: 24 }, (_, hour) => byHour.get(hour) ?? { hour, orders: 0, revenue: 0 });
}

/**
 * One paid order's payment parts with its refunds taken off, so the "Paid by"
 * split adds up to the paid value (`total − refunded_total`) to the Toman.
 *
 * A refund records the way the money went back, so it comes off the part paid
 * that way first (a card refund off the card part). Whatever a refund can't take
 * from a matching part — handed back by a way the guest didn't pay with, or more
 * than that part — is spread over the parts still left in proportion to their
 * amounts, so no method ever goes below nothing. Parts keep their place; one taken
 * down to 0 stays in the list (the order was still paid that way).
 */
export function netPaymentParts(parts: readonly PaymentPart[], refunds: readonly PaymentPart[]): PaymentPart[] {
  const net = parts.map((part) => ({ ...part }));
  let unmatched = 0;
  for (const refund of refunds) {
    let left = refund.amount;
    for (const part of net) {
      if (left <= 0) break;
      if (part.method !== refund.method) continue;
      const taken = Math.min(part.amount, left);
      part.amount -= taken;
      left -= taken;
    }
    unmatched += left;
  }
  if (unmatched > 0) {
    const remaining = net.reduce((sum, part) => sum + part.amount, 0);
    const shares = allocate(
      Math.min(unmatched, remaining),
      net.map((part) => part.amount),
    );
    net.forEach((part, index) => {
      part.amount -= shares[index];
    });
  }
  return net;
}
