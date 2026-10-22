import { NextResponse, type NextRequest } from "next/server";

import { staffSuiteBookingSchema } from "@/src/contracts/suite-booking-schema";
import { cafeDayOf, isCafeDay } from "@/src/domain/entities/CafeTime";
import { SUITE_BOOKING_STATUSES, type SuiteBookingStatus } from "@/src/domain/entities/SuiteBooking";
import { BookSuiteForGuest } from "@/src/domain/use-cases/suite-bookings/RequestSuiteBooking";
import { ListSuiteBookings } from "@/src/domain/use-cases/suite-bookings/SuiteBookingQueries";
import { suiteBookingRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
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

/**
 * POST /api/admin/suite-bookings — staff book the suite for a guest who rang or
 * asked at the counter; it's confirmed straight away (409 `SUITE_TAKEN` when
 * another stay holds any of those nights). Requires `reservations.manage`.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("reservations.manage");
  if (!session) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = staffSuiteBookingSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const booking = await new BookSuiteForGuest(suiteBookingRepository).execute(
      parsed.data,
      { id: session.user.id, name: session.user.name ?? session.user.id },
      new Date(),
    );
    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/admin/suite-bookings failed");
  }
}
