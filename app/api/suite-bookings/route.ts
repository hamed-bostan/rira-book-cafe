import { NextResponse, type NextRequest } from "next/server";

import { requestSuiteBookingSchema } from "@/src/contracts/suite-booking-schema";
import { RequestSuiteBooking } from "@/src/domain/use-cases/suite-bookings/RequestSuiteBooking";
import { ListOwnSuiteBookings } from "@/src/domain/use-cases/suite-bookings/SuiteBookingQueries";
import { suiteBookingRepository, userRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getUserSession } from "@/src/lib/require-auth";

export const dynamic = "force-dynamic";

/** GET /api/suite-bookings — the signed-in guest's own stays, soonest first. */
export async function GET(): Promise<NextResponse> {
  const session = await getUserSession();
  if (!session?.user.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await new ListOwnSuiteBookings(suiteBookingRepository).execute(session.user.id));
  } catch (error) {
    return errorResponseFromException(error, "GET /api/suite-bookings failed");
  }
}

/**
 * POST /api/suite-bookings — ask for the suite. 201 with the booking, which stays
 * `requested` until staff confirm it; 409 `SUITE_TAKEN` for nights already held.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getUserSession();
  if (!session?.user.id) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = requestSuiteBookingSchema.safeParse(body.data);
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

    const booking = await new RequestSuiteBooking(suiteBookingRepository).execute(parsed.data, guest, new Date());
    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/suite-bookings failed");
  }
}
