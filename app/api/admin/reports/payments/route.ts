import { NextResponse, type NextRequest } from "next/server";

import { GetPaymentReport } from "@/src/domain/use-cases/analytics/Reports";
import { analyticsRepository } from "@/src/infrastructure/container";
import { parseAnalyticsRange } from "@/src/lib/api/analytics-params";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/** GET /api/admin/reports/payments — paid vs unpaid for a range, and unpaid served orders to chase. Requires `reports.view`. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await getSessionWith("reports.view"))) return unauthorizedResponse();

  try {
    const report = await new GetPaymentReport(analyticsRepository).execute(
      parseAnalyticsRange(request.nextUrl.searchParams),
    );
    return NextResponse.json(report);
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/reports/payments failed");
  }
}
