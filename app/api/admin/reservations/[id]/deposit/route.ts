import { NextResponse, type NextRequest } from "next/server";

import { reservationDepositSchema, reservationDepositSettleSchema } from "@/src/contracts/booking-money-schema";
import {
  SettleReservationDeposit,
  TakeReservationDeposit,
} from "@/src/domain/use-cases/reservations/ReservationDeposit";
import { reservationDepositRepository, reservationRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith, sessionHas } from "@/src/lib/require-permission";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/reservations/:id/deposit — take a deposit on a booking that's
 * still on: `amount` and `method` (cash, card or transfer). It's held on Deposits
 * held. Requires `reservations.manage`. 409 when the booking already has one, or is over.
 */
export async function POST(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("reservations.manage");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = reservationDepositSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const reservation = await new TakeReservationDeposit(reservationRepository, reservationDepositRepository).execute(
      id,
      parsed.data,
      { id: session.user.id, name: session.user.name ?? session.user.id },
    );
    return NextResponse.json(reservation);
  } catch (error) {
    return errorResponseFromException(error, `POST /api/admin/reservations/${id}/deposit failed`);
  }
}

/**
 * PATCH /api/admin/reservations/:id/deposit — settle a held deposit once the
 * booking is over: `settle: "returned"` hands it back (`reservations.manage`);
 * `settle: "kept"` books it as income, so it also needs `accounting.write`. 409
 * when there's no deposit held, or the booking isn't over yet.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("reservations.manage");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = reservationDepositSettleSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }
  // Keeping the money turns it into the cafe's income: that's the books' call.
  if (parsed.data.settle === "kept" && !(await sessionHas(session, "accounting.write"))) {
    return unauthorizedResponse();
  }

  try {
    const reservation = await new SettleReservationDeposit(reservationRepository, reservationDepositRepository).execute(
      id,
      parsed.data.settle,
      { id: session.user.id, name: session.user.name ?? session.user.id },
    );
    return NextResponse.json(reservation);
  } catch (error) {
    return errorResponseFromException(error, `PATCH /api/admin/reservations/${id}/deposit failed`);
  }
}
