import { NextResponse, type NextRequest } from "next/server";

import { cafeDayOf, isCafeDay } from "@/src/domain/entities/CafeTime";
import { SUITE_BOOKING_STATUSES, type SuiteBookingStatus } from "@/src/domain/entities/SuiteBooking";
import { ListSuiteBookings } from "@/src/domain/use-cases/suite-bookings/SuiteBookingQueries";
import { suiteBookingRepository } from "@/src/infrastructure/container";
import { errorResponse, errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

const STATUS_SET = new Set<string>(SUITE_BOOKING_STATUSES);

/**
 * GET /api/admin/suite-bookings — stays that end after `?from=YYYY-MM-DD` (cafe
 * calendar; defaults to today), in check-in order, optional `?status=`. Readable
 * by anyone with the dashboard.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await getSessionWith("dashboard.view"))) return unauthorizedResponse();

  const params = request.nextUrl.searchParams;
  const from = params.get("from") ?? cafeDayOf(new Date());
  if (!isCafeDay(from)) return errorResponse(400, { message: "`from` must be YYYY-MM-DD.", code: "VALIDATION" });

  const statusParam = params.get("status");
  if (statusParam && !STATUS_SET.has(statusParam)) {
    return errorResponse(400, { message: "Unknown status.", code: "VALIDATION" });
  }

  try {
    const bookings = await new ListSuiteBookings(suiteBookingRepository).execute(
      from,
      (statusParam as SuiteBookingStatus | null) ?? undefined,
    );
    return NextResponse.json(bookings);
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/suite-bookings failed");
  }
}
