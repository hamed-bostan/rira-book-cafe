import { NextResponse, type NextRequest } from "next/server";

import { staffReservationSchema } from "@/src/contracts/reservation-schema";
import { cafeDayOf, isCafeDay, wallTimeToDate } from "@/src/domain/entities/CafeTime";
import { RESERVATION_STATUSES, type ReservationStatus } from "@/src/domain/entities/Reservation";
import { BookTableForGuest } from "@/src/domain/use-cases/reservations/RequestReservation";
import { ListReservationsForDay } from "@/src/domain/use-cases/reservations/ReservationQueries";
import { reservationRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
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

/**
 * POST /api/admin/reservations — staff book a table for a guest who rang or walked
 * in. With a `tableLabel` it's confirmed on the spot (409 `TABLE_TAKEN` /
 * `TABLE_HELD` when a booking or an event has that table then); without, it's a
 * request. Requires `reservations.manage`.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("reservations.manage");
  if (!session) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = staffReservationSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const { startsAt, ...rest } = parsed.data;
    const reservation = await new BookTableForGuest(reservationRepository).execute(
      { ...rest, startsAt: wallTimeToDate(startsAt) },
      { id: session.user.id, name: session.user.name ?? session.user.id },
      new Date(),
    );
    return NextResponse.json(reservation, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/admin/reservations failed");
  }
}
