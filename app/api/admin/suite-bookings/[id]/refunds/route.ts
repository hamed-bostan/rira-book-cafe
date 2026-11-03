import { NextResponse, type NextRequest } from "next/server";

import { refundSchema } from "@/src/contracts/booking-money-schema";
import { RefundBookingPayment } from "@/src/domain/use-cases/income/RefundBookingPayment";
import {
  customerNotifier,
  eventRepository,
  incomeRepository,
  suiteBookingRepository,
} from "@/src/infrastructure/container";
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
 * POST /api/admin/suite-bookings/:id/refunds — hand back money paid for a stay:
 * `amount` (up to what's been paid and not yet refunded), `method`, an optional
 * `reason`. Booked against the payments' revenue account and VAT; the guest is
 * told. Requires `accounting.write`. 400 (`amount`) for more than is left.
 */
export async function POST(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("accounting.write");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = refundSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const refunds = await new RefundBookingPayment(
      incomeRepository,
      suiteBookingRepository,
      eventRepository,
      customerNotifier,
    ).execute({ sourceType: "suiteBooking", sourceId: id }, parsed.data, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(refunds, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, `POST /api/admin/suite-bookings/${id}/refunds failed`);
  }
}
