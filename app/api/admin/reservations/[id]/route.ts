import { NextResponse, type NextRequest } from "next/server";

import { reservationUpdateSchema } from "@/src/contracts/reservation-schema";
import { ChangeReservation } from "@/src/domain/use-cases/reservations/ChangeReservation";
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
 * PATCH /api/admin/reservations/:id — confirm, seat, complete, cancel or mark a
 * no-show, and/or assign a table. Requires `reservations.manage`. 409 for a
 * transition the workflow refuses or a table another booking holds.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("reservations.manage");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = reservationUpdateSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const reservation = await new ChangeReservation(reservationRepository, customerNotifier).execute(id, parsed.data, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(reservation);
  } catch (error) {
    return errorResponseFromException(error, `PATCH /api/admin/reservations/${id} failed`);
  }
}
