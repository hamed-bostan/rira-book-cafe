import { type NextRequest } from "next/server";

import { calendarForLocale } from "@/src/domain/entities/Analytics";
import { GetReportTable } from "@/src/domain/use-cases/analytics/Reports";
import { analyticsRepository } from "@/src/infrastructure/container";
import { parseCsvLocale } from "@/src/lib/api/accounting-csv";
import { parseAnalyticsRange, parseRefundTiming, parseTopItemSort } from "@/src/lib/api/analytics-params";
import { csvResponse } from "@/src/lib/api/csv-response";
import { reportFileName, reportMessages, reportTableOf, reportTableRows } from "@/src/lib/api/report-csv";
import { errorResponse, errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ table: string }> };

/**
 * GET /api/admin/reports/export/:table — one of the reports' tables, whole, as a
 * CSV download in `?locale=` (Excel-ready: UTF-8 with a BOM). Takes the reports'
 * own `?range=` or `?from=&to=`, `?refunds=` and `?sort=`, so the file holds what
 * the screen shows. Tables: sales-by-day, top-items, discounts, streams,
 * payments-by-method, unpaid-orders, guests. Requires `reports.view`.
 */
export async function GET(request: NextRequest, { params }: RouteContext): Promise<Response> {
  if (!(await getSessionWith("reports.view"))) return unauthorizedResponse();
  const { table: slug } = await params;
  const table = reportTableOf(slug);
  if (!table) return errorResponse(404, { message: "No such table.", code: "NOT_FOUND" });

  try {
    const query = request.nextUrl.searchParams;
    const locale = parseCsvLocale(query);
    const now = new Date();
    const range = parseAnalyticsRange(query, now, calendarForLocale(locale));
    const refunds = parseRefundTiming(query);
    const [data, messages] = await Promise.all([
      new GetReportTable(analyticsRepository).execute(
        table,
        { range, refunds, sort: parseTopItemSort(query) },
        now,
        locale,
      ),
      reportMessages(locale),
    ]);
    return csvResponse(reportFileName(table, range), reportTableRows(data, range, refunds, messages, locale));
  } catch (error) {
    return errorResponseFromException(error, `GET /api/admin/reports/export/${slug} failed`);
  }
}
