import type en from "@/messages/en.json";
import type { DateRange, RefundTiming } from "@/src/domain/entities/Analytics";
import { dateToWallTime } from "@/src/domain/entities/CafeTime";
import { jalaliDayLabel } from "@/src/domain/entities/JalaliCalendar";
import type { ReportTable, ReportTableRows } from "@/src/domain/use-cases/analytics/Reports";
import type { Locale } from "@/src/i18n/routing";

import type { CsvCell } from "../csv";

/**
 * A report's tables as spreadsheet rows, in the reader's language: a title, the
 * dates and how refunds were counted, then the table with amounts as plain whole
 * Toman — so a spreadsheet can add them up.
 */
export type ReportMessages = (typeof en)["dashReports"];
type OrderMessages = (typeof en)["dashOrders"];

type Row = readonly CsvCell[];

/** The URL slug of each table, as the export links name it. */
export const REPORT_TABLE_SLUGS: Record<ReportTable, string> = {
  salesByDay: "sales-by-day",
  topItems: "top-items",
  discounts: "discounts",
  streams: "streams",
  paymentsByMethod: "payments-by-method",
  unpaidOrders: "unpaid-orders",
  guests: "guests",
};

/** The table a slug names, or `null` for one that doesn't exist. */
export function reportTableOf(slug: string): ReportTable | null {
  const found = Object.entries(REPORT_TABLE_SLUGS).find(([, value]) => value === slug);
  return found ? (found[0] as ReportTable) : null;
}

/** Every label used here is plain text, so the catalog is read without a translator. */
export async function reportMessages(locale: Locale): Promise<{ reports: ReportMessages; orders: OrderMessages }> {
  const catalog = (await import(`../../../messages/${locale}.json`)) as {
    default: { dashReports: ReportMessages; dashOrders: OrderMessages };
  };
  return { reports: catalog.default.dashReports, orders: catalog.default.dashOrders };
}

/** A day on the calendar its reader keeps: "1405/07/28" in Persian, "2026-10-20" otherwise. */
const dayLabel = (day: string, locale: Locale): string => (locale === "fa" ? jalaliDayLabel(day) : day);

/** An instant on the cafe clock: the day as above, then the time. */
function wallTimeLabel(iso: string, locale: Locale): string {
  const wall = dateToWallTime(new Date(iso));
  return `${dayLabel(wall.slice(0, 10), locale)} ${wall.slice(11, 16)}`;
}

/** The file's name: the table and its dates. */
export function reportFileName(table: ReportTable, range: Pick<DateRange, "fromDay" | "toDay">): string {
  return `${REPORT_TABLE_SLUGS[table]}-${range.fromDay}-to-${range.toDay}.csv`;
}

/** The rows of a table, under a header naming it, its dates and its refund timing. */
export function reportTableRows(
  data: ReportTableRows,
  range: Pick<DateRange, "fromDay" | "toDay">,
  refunds: RefundTiming,
  messages: { reports: ReportMessages; orders: OrderMessages },
  locale: Locale,
): Row[] {
  const { reports: t, orders } = messages;
  const { columns } = t.export;
  const header: Row[] = [
    [t.export.table[data.table]],
    [t.export.period, dayLabel(range.fromDay, locale), dayLabel(range.toDay, locale)],
    [t.export.refundsLine, t.refunds.option[refunds]],
    [],
  ];

  switch (data.table) {
    case "salesByDay":
      return [
        ...header,
        [columns.day, columns.orders, columns.revenue, columns.unpaidOrders, columns.unpaidValue],
        ...data.rows.map((row): Row => [
          dayLabel(row.day, locale),
          row.orders,
          row.revenue,
          row.unpaidOrders,
          row.unpaidValue,
        ]),
      ];
    case "topItems":
      return [
        ...header,
        [columns.item, columns.category, columns.kind, columns.units, columns.revenue],
        ...data.rows.map((row): Row => [
          row.name,
          row.categoryName ?? undefined,
          t.sales.kind[row.kind],
          row.quantity,
          row.revenue,
        ]),
      ];
    case "discounts":
      return [
        ...header,
        [columns.code, columns.uses, columns.discount, columns.revenue],
        ...data.rows.map((row): Row => [row.code, row.uses, row.discount, row.revenue]),
      ];
    case "streams":
      return [
        ...header,
        [
          columns.stream,
          columns.received,
          columns.refunded,
          columns.revenue,
          columns.vat,
          columns.revenueExVat,
          columns.previousRevenue,
        ],
        ...data.rows.map((row): Row => [
          t.streams.stream[row.stream],
          row.received,
          row.refunded,
          row.revenue,
          row.vat,
          row.revenueExVat,
          row.previousRevenue,
        ]),
        [
          columns.total,
          ...(["received", "refunded", "revenue", "vat", "revenueExVat", "previousRevenue"] as const).map((key) =>
            data.rows.reduce((sum, row) => sum + row[key], 0),
          ),
        ],
      ];
    case "paymentsByMethod":
      return [
        ...header,
        [columns.method, columns.orders, columns.value],
        ...data.rows.map((row): Row => [orders.paymentMethod[row.method], row.orders, row.value]),
      ];
    case "unpaidOrders":
      return [
        ...header,
        [columns.orderNumber, columns.placedAt, columns.where, columns.total],
        ...data.rows.map((row): Row => [
          row.orderNumber,
          wallTimeLabel(row.placedAt, locale),
          row.serviceType === "dineIn" && row.tableLabel
            ? orders.table.replace("{table}", row.tableLabel)
            : orders.service[row.serviceType],
          row.total,
        ]),
      ];
    case "guests":
      return [
        ...header,
        [columns.guest, columns.phone, columns.orders, columns.revenue],
        ...data.rows.map((row): Row => [row.name, row.phone, row.orders, row.revenue]),
      ];
  }
}
