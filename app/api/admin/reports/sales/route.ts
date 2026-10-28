import { NextResponse, type NextRequest } from "next/server";

import { GetSalesReport } from "@/src/domain/use-cases/analytics/Reports";
import { analyticsRepository } from "@/src/infrastructure/container";
import { parseAnalyticsRange, parseTopItemSort } from "@/src/lib/api/analytics-params";
import { getRequestLocale } from "@/src/lib/api/request-locale";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/reports/sales — revenue, orders, sales by day and by hour, by kind,
 * and best sellers (with their category, in the `Accept-Language` locale) for a
 * range, against the period before it — today against yesterday at this time.
 * `?range=` preset or `?from=&to=` cafe days; `?sort=revenue|quantity` for the
 * top items. Requires `reports.view`.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await getSessionWith("reports.view"))) return unauthorizedResponse();

  try {
    const params = request.nextUrl.searchParams;
    const now = new Date();
    const report = await new GetSalesReport(analyticsRepository).execute(
      parseAnalyticsRange(params, now),
      parseTopItemSort(params),
      now,
      getRequestLocale(request),
    );
    return NextResponse.json(report);
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/reports/sales failed");
  }
}
