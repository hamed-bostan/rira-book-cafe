import { NextResponse, type NextRequest } from "next/server";

import { suiteStaySchema } from "@/src/contracts/suite-booking-schema";
import { EditSuiteStay } from "@/src/domain/use-cases/suite-bookings/EditSuiteStay";
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
 * PATCH /api/admin/suite-bookings/:id/details — change a stay's arrival and
 * departure days and party; once the guest is in, only the departure. Requires
 * `reservations.manage`. 400 for a detail its status won't let change or days the
 * rules refuse; 409 `SUITE_TAKEN` when another stay holds the new nights, or
 * `INVALID_TRANSITION` for a stay that's over or was just changed.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("reservations.manage");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = suiteStaySchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const booking = await new EditSuiteStay(suiteBookingRepository, customerNotifier).execute(
      id,
      parsed.data,
      { id: session.user.id, name: session.user.name ?? session.user.id },
      new Date(),
    );
    return NextResponse.json(booking);
  } catch (error) {
    return errorResponseFromException(error, `PATCH /api/admin/suite-bookings/${id}/details failed`);
  }
}
