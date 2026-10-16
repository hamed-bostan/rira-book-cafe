import { NextResponse } from "next/server";

import { GetDashboardOverview } from "@/src/domain/use-cases/analytics/Reports";
import { analyticsRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/analytics/overview — the floor's numbers right now: orders in the
 * queue, today's bookings, this week's events. Money-free, so every dashboard role
 * may read it; revenue lives behind `reports.view` in the sales report.
 */
export async function GET(): Promise<NextResponse> {
  if (!(await getSessionWith("dashboard.view"))) return unauthorizedResponse();

  try {
    return NextResponse.json(await new GetDashboardOverview(analyticsRepository).execute(new Date()));
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/analytics/overview failed");
  }
}
