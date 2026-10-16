import { NextResponse } from "next/server";

import { CancelOwnReservation } from "@/src/domain/use-cases/reservations/ChangeReservation";
import { reservationRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getUserSession } from "@/src/lib/require-auth";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/reservations/:id/cancel — the guest withdraws their own booking
 * before it starts. 409 once they're seated or it has started; 404 for anyone else's.
 */
export async function POST(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const session = await getUserSession();
  if (!session?.user.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    const reservation = await new CancelOwnReservation(reservationRepository).execute(
      id,
      { id: session.user.id, name: session.user.name ?? session.user.id },
      new Date(),
    );
    return NextResponse.json(reservation);
  } catch (error) {
    return errorResponseFromException(error, `POST /api/reservations/${id}/cancel failed`);
  }
}
