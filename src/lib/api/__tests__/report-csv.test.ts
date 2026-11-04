import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import fa from "@/messages/fa.json";

import { toCsv } from "../../csv";
import { REPORT_TABLE_SLUGS, reportFileName, reportTableOf, reportTableRows } from "../report-csv";

const RANGE = { fromDay: "2026-10-15", toDay: "2026-10-21" };

describe("report tables as CSV", () => {
  it("knows each table by its slug", () => {
    for (const [table, slug] of Object.entries(REPORT_TABLE_SLUGS)) expect(reportTableOf(slug)).toBe(table);
    expect(reportTableOf("secrets")).toBeNull();
    expect(reportFileName("salesByDay", RANGE)).toBe("sales-by-day-2026-10-15-to-2026-10-21.csv");
  });

  it("heads the file with the table, its dates and how refunds were counted", () => {
    const rows = reportTableRows(
      {
        table: "salesByDay",
        rows: [{ day: "2026-10-15", orders: 2, revenue: 190000, unpaidOrders: 0, unpaidValue: 0 }],
      },
      RANGE,
      "refundDay",
      { reports: en.dashReports, orders: en.dashOrders },
      "en",
    );
    expect(rows[0]).toEqual(["Sales by day"]);
    expect(rows[1]).toEqual(["Period", "2026-10-15", "2026-10-21"]);
    expect(rows[2]).toEqual(["Refunds counted", "On the refund's day"]);
    expect(rows.at(-1)).toEqual(["2026-10-15", 2, 190000, 0, 0]);
  });

  it("writes Persian dates on the Jalali calendar, in a file Excel opens as UTF-8", () => {
    const rows = reportTableRows(
      {
        table: "unpaidOrders",
        rows: [
          {
            id: "o1",
            orderNumber: 42,
            serviceType: "dineIn",
            tableLabel: "T4",
            total: 95000,
            placedAt: "2026-10-21T08:30:00.000Z",
          },
        ],
      },
      RANGE,
      "orderDay",
      { reports: fa.dashReports, orders: fa.dashOrders },
      "fa",
    );
    expect(rows[1]).toEqual([fa.dashReports.export.period, "1405/07/23", "1405/07/29"]);
    expect(rows.at(-1)).toEqual([42, "1405/07/29 12:00", fa.dashOrders.table.replace("{table}", "T4"), 95000]);
    expect(toCsv(rows).startsWith("﻿")).toBe(true);
  });

  it("totals the revenue streams", () => {
    const stream = (key: "cafe" | "suite", revenue: number) => ({
      stream: key,
      received: revenue,
      refunded: 0,
      revenue,
      vat: 0,
      revenueExVat: revenue,
      previousRevenue: 0,
    });
    const rows = reportTableRows(
      { table: "streams", rows: [stream("cafe", 100), stream("suite", 50)] },
      RANGE,
      "orderDay",
      { reports: en.dashReports, orders: en.dashOrders },
      "en",
    );
    expect(rows.at(-1)).toEqual(["Total", 150, 0, 150, 0, 150, 0]);
  });
});
