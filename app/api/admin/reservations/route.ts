import { NextResponse, type NextRequest } from "next/server";

import { staffReservationSchema } from "@/src/contracts/reservation-schema";
import { cafeDayOf, isCafeDay, wallTimeToDate } from "@/src/domain/entities/CafeTime";
import { RESERVATION_STATUSES, type ReservationStatus } from "@/src/domain/entities/Reservation";
import { BookTableForGuest } from "@/src/domain/use-cases/reservations/RequestReservation";
import { ListReservationsForDay, ListReservationsFrom } from "@/src/domain/use-cases/reservations/ReservationQueries";
import { reservationRepository, userRepository } from "@/src/infrastructure/container";
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
 * GET /api/admin/reservations — one cafe day's reservations, in start order:
 * `?day=YYYY-MM-DD` (cafe calendar; defaults to today). Or, with
 * `?from=YYYY-MM-DD` instead, every reservation from that day on — how requests
 * waiting on later days are found. Optional `?status=`. Readable by anyone with
 * the dashboard.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await getSessionWith("dashboard.view"))) return unauthorizedResponse();

  const params = request.nextUrl.searchParams;
  const from = params.get("from");
  if (from !== null && params.has("day")) {
    return errorResponse(400, { message: "Pass `day` or `from`, not both.", code: "VALIDATION" });
  }
  if (from !== null && !isCafeDay(from)) {
    return errorResponse(400, { message: "`from` must be YYYY-MM-DD.", code: "VALIDATION" });
  }
  const day = params.get("day") ?? cafeDayOf(new Date());
  if (!isCafeDay(day)) return errorResponse(400, { message: "`day` must be YYYY-MM-DD.", code: "VALIDATION" });

  const statusParam = params.get("status");
  if (statusParam && !STATUS_SET.has(statusParam)) {
    return errorResponse(400, { message: "Unknown status.", code: "VALIDATION" });
  }
  const status = (statusParam as ReservationStatus | null) ?? undefined;

  try {
    const reservations =
      from === null
        ? await new ListReservationsForDay(reservationRepository).execute(day, status)
        : await new ListReservationsFrom(reservationRepository).execute(from, status);
    return NextResponse.json(reservations);
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/reservations failed");
  }
}

/**
 * POST /api/admin/reservations — staff book a table for a guest, on the profile
 * `guestPhone` finds (made from `guestName`, with the booking, when it has none;
 * 400 `guestName` when a new guest has no name). With a `tableLabel` it's
 * confirmed on the spot (409 `TABLE_TAKEN` / `TABLE_HELD` when a booking or an
 * event has that table then); without, it's a request. Requires `reservations.manage`.
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
    const reservation = await new BookTableForGuest(reservationRepository, userRepository).execute(
      { ...rest, startsAt: wallTimeToDate(startsAt) },
      { id: session.user.id, name: session.user.name ?? session.user.id },
      new Date(),
    );
    return NextResponse.json(reservation, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/admin/reservations failed");
  }
}
