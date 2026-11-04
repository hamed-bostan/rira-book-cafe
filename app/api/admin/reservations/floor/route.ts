import { NextResponse, type NextRequest } from "next/server";

import { cafeDayOf, isCafeDay } from "@/src/domain/entities/CafeTime";
import { ReadFloorForDay } from "@/src/domain/use-cases/reservations/FloorQueries";
import { cafeTableRepository, eventRepository, reservationRepository } from "@/src/infrastructure/container";
import { errorResponse, errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/reservations/floor — what holds the tables around one cafe day
 * (`?day=YYYY-MM-DD`, defaults to today): the bookings holding a table and the
 * events holding tables, from the day before to the day after, for the table
 * pickers. Readable by anyone with the dashboard.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await getSessionWith("dashboard.view"))) return unauthorizedResponse();

  const day = request.nextUrl.searchParams.get("day") ?? cafeDayOf(new Date());
  if (!isCafeDay(day)) return errorResponse(400, { message: "`day` must be YYYY-MM-DD.", code: "VALIDATION" });

  try {
    return NextResponse.json(
      await new ReadFloorForDay(reservationRepository, eventRepository, cafeTableRepository).execute(day),
    );
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/reservations/floor failed");
  }
}
