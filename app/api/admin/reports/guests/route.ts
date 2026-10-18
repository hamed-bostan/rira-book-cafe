import { NextResponse, type NextRequest } from "next/server";

import { GetGuestReport } from "@/src/domain/use-cases/analytics/Reports";
import { analyticsRepository } from "@/src/infrastructure/container";
import { parseAnalyticsRange } from "@/src/lib/api/analytics-params";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/** GET /api/admin/reports/guests — new vs returning guests, top spenders, bookings and events for a range. Requires `reports.view`. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await getSessionWith("reports.view"))) return unauthorizedResponse();

  try {
    const report = await new GetGuestReport(analyticsRepository).execute(
      parseAnalyticsRange(request.nextUrl.searchParams),
    );
    return NextResponse.json(report);
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/reports/guests failed");
  }
}
