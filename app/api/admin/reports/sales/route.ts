import { NextResponse, type NextRequest } from "next/server";

import { calendarForLocale } from "@/src/domain/entities/Analytics";
import { GetSalesReport } from "@/src/domain/use-cases/analytics/Reports";
import { analyticsRepository } from "@/src/infrastructure/container";
import { parseAnalyticsRange, parseRefundTiming, parseTopItemSort } from "@/src/lib/api/analytics-params";
import { getRequestLocale } from "@/src/lib/api/request-locale";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/reports/sales — revenue and the walk from gross sales to it,
 * orders, sales by day and by hour, by kind, best sellers (with their category, in
 * the `Accept-Language` locale), discounts and every revenue stream for a range,
 * against the period before it — today against yesterday at this time.
 * `?range=` preset (month presets on the `Accept-Language` reader's calendar) or
 * `?from=&to=` cafe days; `?refunds=orderDay|refundDay`; `?sort=revenue|quantity`
 * for the top items. Requires `reports.view`.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await getSessionWith("reports.view"))) return unauthorizedResponse();

  try {
    const params = request.nextUrl.searchParams;
    const now = new Date();
    const locale = getRequestLocale(request);
    const report = await new GetSalesReport(analyticsRepository).execute(
      {
        range: parseAnalyticsRange(params, now, calendarForLocale(locale)),
        refunds: parseRefundTiming(params),
        sort: parseTopItemSort(params),
      },
      now,
      locale,
    );
    return NextResponse.json(report);
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/reports/sales failed");
  }
}
