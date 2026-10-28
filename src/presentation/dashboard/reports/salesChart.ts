/**
 * How a range's sales are drawn: one day by the hour, up to a month by the day,
 * anything longer by the week — so the chart never has more than about thirty bars.
 */
export type SalesChartKind = "hourly" | "daily" | "weekly";

/** One bar: when it covers, what it took, and how it's labelled. */
export type SalesChartPoint = {
  /** The day the bar covers — or, for a week, the first day of it. */
  day: string;
  /** The hour of `day` the bar covers, on an hourly chart. */
  hour?: number;
  revenue: number;
  orders: number;
  /** Whether it gets a label under it — on a dense chart only every few bars do. */
  labelled: boolean;
  /** Still in progress (the current hour, today, this week) — drawn lighter so it doesn't read as a dip. */
  soft: boolean;
};

export type SalesChart = { kind: SalesChartKind; points: SalesChartPoint[] };

/** Gridlines above the chart's baseline. */
export const Y_TICKS = 3;
/** Multipliers a tick step snaps to — 1, 2 or 5 × 10ⁿ — so the axis reads 0 · 5M · 10M · 15M rather than 0 · 3.7M · … */
const NICE_STEPS = [1, 2, 5, 10];

/** The y-axis step: the smallest 1, 2 or 5 × 10ⁿ whose top tick clears `max` — never under 1, so no half orders. */
export function chartTickStep(max: number): number {
  const raw = Math.max(1, max) / Y_TICKS;
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(1, raw)));
  return (NICE_STEPS.find((multiple) => multiple * magnitude >= raw) ?? 10) * magnitude;
}

/** Longest range drawn a day per bar; longer ones go by the week. */
export const DAILY_CHART_MAX_DAYS = 30;
/** The hours a one-day chart always spans, busy or not — the cafe's usual day. */
const DAY_FIRST_HOUR = 8;
const DAY_LAST_HOUR = 22;
const DAYS_PER_WEEK = 7;
/** On a one-day chart, every second hour is labelled. */
const HOUR_LABEL_EVERY = 2;
/** On a weekly chart, every second week is labelled. */
const WEEK_LABEL_EVERY = 2;

type Sales = { revenue: number; orders: number };

/**
 * The bars for a range's sales chart, from the report's day and hour series.
 * `now` is the cafe day and hour it is, so the bar still filling up is drawn soft.
 */
export function buildSalesChart(
  daily: readonly (Sales & { day: string })[],
  hourly: readonly (Sales & { hour: number })[],
  now: { day: string; hour: number },
): SalesChart {
  const days = daily.length;

  if (days === 1) {
    const day = daily[0].day;
    const busy = hourly.filter((point) => point.orders > 0).map((point) => point.hour);
    const first = Math.min(DAY_FIRST_HOUR, ...busy);
    const last = Math.max(DAY_LAST_HOUR, ...busy);
    return {
      kind: "hourly",
      points: hourly
        .filter((point) => point.hour >= first && point.hour <= last)
        .map((point) => ({
          day,
          hour: point.hour,
          revenue: point.revenue,
          orders: point.orders,
          labelled: (point.hour - first) % HOUR_LABEL_EVERY === 0,
          soft: day === now.day && point.hour === now.hour,
        })),
    };
  }

  if (days <= DAILY_CHART_MAX_DAYS) {
    return {
      kind: "daily",
      points: daily.map((point, index) => ({
        day: point.day,
        revenue: point.revenue,
        orders: point.orders,
        // A week labels every day; a longer span labels a day a week, counted back from the last.
        labelled: days <= DAYS_PER_WEEK || (days - 1 - index) % DAYS_PER_WEEK === 0,
        soft: point.day === now.day,
      })),
    };
  }

  // Weeks are counted back from the range's last day, so the last bar ends on it and
  // only the first week can be short.
  const weeks = Math.ceil(days / DAYS_PER_WEEK);
  return {
    kind: "weekly",
    points: Array.from({ length: weeks }, (_, week) => {
      const end = days - (weeks - 1 - week) * DAYS_PER_WEEK;
      const slice = daily.slice(Math.max(0, end - DAYS_PER_WEEK), end);
      const lastDay = slice[slice.length - 1].day;
      return {
        day: slice[0].day,
        revenue: slice.reduce((sum, point) => sum + point.revenue, 0),
        orders: slice.reduce((sum, point) => sum + point.orders, 0),
        labelled: (weeks - 1 - week) % WEEK_LABEL_EVERY === 0,
        soft: now.day >= slice[0].day && now.day <= lastDay,
      };
    }),
  };
}
