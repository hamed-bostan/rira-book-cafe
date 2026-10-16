import { NextResponse } from "next/server";

import { CancelOwnSuiteBooking } from "@/src/domain/use-cases/suite-bookings/ChangeSuiteBooking";
import { suiteBookingRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getUserSession } from "@/src/lib/require-auth";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/suite-bookings/:id/cancel — the guest withdraws their own stay before
 * the check-in day. 409 after that; 404 for anyone else's.
 */
export async function POST(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const session = await getUserSession();
  if (!session?.user.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    const booking = await new CancelOwnSuiteBooking(suiteBookingRepository).execute(id, session.user.id, new Date());
    return NextResponse.json(booking);
  } catch (error) {
    return errorResponseFromException(error, `POST /api/suite-bookings/${id}/cancel failed`);
  }
}
