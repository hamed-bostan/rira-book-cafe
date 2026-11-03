import { NextResponse, type NextRequest } from "next/server";

import { suiteRateSchema } from "@/src/contracts/booking-money-schema";
import { SetSuiteStayRate } from "@/src/domain/use-cases/suite-bookings/SuitePricing";
import { suiteBookingRepository, suitePricingRepository } from "@/src/infrastructure/container";
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
 * PUT /api/admin/suite-bookings/:id/rate — price one stay at its own `nightlyRate`;
 * its total follows (nights × rate). It's what the guest is charged, so it
 * requires `accounting.write`.
 */
export async function PUT(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("accounting.write");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = suiteRateSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const booking = await new SetSuiteStayRate(suiteBookingRepository, suitePricingRepository).execute(
      id,
      parsed.data.nightlyRate,
      { id: session.user.id, name: session.user.name ?? session.user.id },
    );
    return NextResponse.json(booking);
  } catch (error) {
    return errorResponseFromException(error, `PUT /api/admin/suite-bookings/${id}/rate failed`);
  }
}
