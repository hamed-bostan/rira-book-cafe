import { NextResponse, type NextRequest } from "next/server";

import { suiteBookingUpdateSchema } from "@/src/contracts/suite-booking-schema";
import { ChangeSuiteBooking } from "@/src/domain/use-cases/suite-bookings/ChangeSuiteBooking";
import { customerNotifier, suiteBookingRepository } from "@/src/infrastructure/container";
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
 * PATCH /api/admin/suite-bookings/:id — confirm, check in, check out, cancel or
 * mark a no-show. Requires `reservations.manage`. 409 for a transition the
 * workflow refuses, or `SUITE_TAKEN` when another stay already holds those nights.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("reservations.manage");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = suiteBookingUpdateSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const booking = await new ChangeSuiteBooking(suiteBookingRepository, customerNotifier).execute(
      id,
      parsed.data.status,
      {
        id: session.user.id,
        name: session.user.name ?? session.user.id,
      },
    );
    return NextResponse.json(booking);
  } catch (error) {
    return errorResponseFromException(error, `PATCH /api/admin/suite-bookings/${id} failed`);
  }
}
