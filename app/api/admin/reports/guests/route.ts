import { NextResponse, type NextRequest } from "next/server";

import { calendarForLocale } from "@/src/domain/entities/Analytics";
import { GetGuestReport } from "@/src/domain/use-cases/analytics/Reports";
import { analyticsRepository } from "@/src/infrastructure/container";
import { parseAnalyticsRange } from "@/src/lib/api/analytics-params";
import { getRequestLocale } from "@/src/lib/api/request-locale";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/** GET /api/admin/reports/guests — guests against the period before (today: yesterday at this time), new vs returning, top spenders and bookings for a range. Requires `reports.view`. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await getSessionWith("reports.view"))) return unauthorizedResponse();

  try {
    const now = new Date();
    const report = await new GetGuestReport(analyticsRepository).execute(
      parseAnalyticsRange(request.nextUrl.searchParams, now, calendarForLocale(getRequestLocale(request))),
      now,
    );
    return NextResponse.json(report);
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/reports/guests failed");
  }
}
