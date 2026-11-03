import { NextResponse, type NextRequest } from "next/server";

import { reservationDetailsSchema } from "@/src/contracts/reservation-schema";
import { wallTimeToDate } from "@/src/domain/entities/CafeTime";
import { EditReservation } from "@/src/domain/use-cases/reservations/EditReservation";
import { customerNotifier, reservationRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/reservations/:id/details — edit a booking: its day and time,
 * party, length, the note, the table (not the guest: that's its profile). Requires
 * `reservations.manage`. 400 for a detail its status won't let change (only the
 * length and the table once seated) or a time in the past; 409 `TABLE_TAKEN` /
 * `TABLE_HELD` when the table is someone else's at the new time, or
 * `INVALID_TRANSITION` for a booking that's over or was just changed.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("reservations.manage");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = reservationDetailsSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const { startsAt, ...rest } = parsed.data;
    const reservation = await new EditReservation(reservationRepository, customerNotifier).execute(
      id,
      { ...rest, startsAt: startsAt === undefined ? undefined : wallTimeToDate(startsAt) },
      { id: session.user.id, name: session.user.name ?? session.user.id },
      new Date(),
    );
    return NextResponse.json(reservation);
  } catch (error) {
    return errorResponseFromException(error, `PATCH /api/admin/reservations/${id}/details failed`);
  }
}
