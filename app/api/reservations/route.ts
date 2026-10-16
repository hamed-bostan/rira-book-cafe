import { NextResponse, type NextRequest } from "next/server";

import { requestReservationSchema } from "@/src/contracts/reservation-schema";
import { wallTimeToDate } from "@/src/domain/entities/CafeTime";
import { RequestReservation } from "@/src/domain/use-cases/reservations/RequestReservation";
import { ListOwnReservations } from "@/src/domain/use-cases/reservations/ReservationQueries";
import { reservationRepository, userRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getUserSession } from "@/src/lib/require-auth";

export const dynamic = "force-dynamic";

/** GET /api/reservations — the signed-in guest's own reservations, soonest first. */
export async function GET(): Promise<NextResponse> {
  const session = await getUserSession();
  if (!session?.user.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await new ListOwnReservations(reservationRepository).execute(session.user.id));
  } catch (error) {
    return errorResponseFromException(error, "GET /api/reservations failed");
  }
}

/**
 * POST /api/reservations — ask for a table. 201 with the reservation, which stays
 * `requested` until staff confirm it. `startsAt` is cafe wall time.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getUserSession();
  if (!session?.user.id) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = requestReservationSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    // The guest's name and phone come from their account, never from the request.
    const guest = await userRepository.getById(session.user.id);
    if (!guest) return unauthorizedResponse();

    const reservation = await new RequestReservation(reservationRepository).execute(
      { startsAt: wallTimeToDate(parsed.data.startsAt), partySize: parsed.data.partySize, note: parsed.data.note },
      guest,
      new Date(),
    );
    return NextResponse.json(reservation, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/reservations failed");
  }
}
