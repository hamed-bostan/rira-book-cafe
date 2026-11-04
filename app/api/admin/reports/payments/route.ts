import { NextResponse, type NextRequest } from "next/server";

import { calendarForLocale } from "@/src/domain/entities/Analytics";
import { GetPaymentReport } from "@/src/domain/use-cases/analytics/Reports";
import { analyticsRepository } from "@/src/infrastructure/container";
import { parseAnalyticsRange, parseRefundTiming } from "@/src/lib/api/analytics-params";
import { getRequestLocale } from "@/src/lib/api/request-locale";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/reports/payments — paid vs unpaid for a range against the period
 * before, how it was paid, unpaid served (ready or completed) orders to chase, and
 * the VAT inside each revenue stream. Takes the sales report's `?range=`,
 * `?from=&to=` and `?refunds=`. Requires `reports.view`.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await getSessionWith("reports.view"))) return unauthorizedResponse();

  try {
    const params = request.nextUrl.searchParams;
    const now = new Date();
    const report = await new GetPaymentReport(analyticsRepository).execute(
      {
        range: parseAnalyticsRange(params, now, calendarForLocale(getRequestLocale(request))),
        refunds: parseRefundTiming(params),
      },
      now,
    );
    return NextResponse.json(report);
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/reports/payments failed");
  }
}
