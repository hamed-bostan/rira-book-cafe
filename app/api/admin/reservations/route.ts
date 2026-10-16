import { NextResponse, type NextRequest } from "next/server";

import { cafeDayOf, isCafeDay } from "@/src/domain/entities/CafeTime";
import { RESERVATION_STATUSES, type ReservationStatus } from "@/src/domain/entities/Reservation";
import { ListReservationsForDay } from "@/src/domain/use-cases/reservations/ReservationQueries";
import { reservationRepository } from "@/src/infrastructure/container";
import { errorResponse, errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

const STATUS_SET = new Set<string>(RESERVATION_STATUSES);

/**
 * GET /api/admin/reservations — one cafe day's reservations, in start order.
 * `?day=YYYY-MM-DD` (cafe calendar; defaults to today) and optional `?status=`.
 * Readable by anyone with the dashboard.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await getSessionWith("dashboard.view"))) return unauthorizedResponse();

  const params = request.nextUrl.searchParams;
  const day = params.get("day") ?? cafeDayOf(new Date());
  if (!isCafeDay(day)) return errorResponse(400, { message: "`day` must be YYYY-MM-DD.", code: "VALIDATION" });

  const statusParam = params.get("status");
  if (statusParam && !STATUS_SET.has(statusParam)) {
    return errorResponse(400, { message: "Unknown status.", code: "VALIDATION" });
  }

  try {
    const reservations = await new ListReservationsForDay(reservationRepository).execute(
      day,
      (statusParam as ReservationStatus | null) ?? undefined,
    );
    return NextResponse.json(reservations);
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/reservations failed");
  }
}
