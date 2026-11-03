import { NextResponse, type NextRequest } from "next/server";

import { guestMessageSchema } from "@/src/contracts/guest-message-schema";
import { GUEST_MESSAGE_PERMISSION } from "@/src/domain/entities/GuestMessage";
import { MessageGuest } from "@/src/domain/use-cases/notifications/MessageGuest";
import {
  bookLoanRepository,
  bookWaitlistRepository,
  eventRepository,
  notificationRepository,
  orderRepository,
  reservationRepository,
  suiteBookingRepository,
} from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith, sessionHas } from "@/src/lib/require-permission";

/**
 * POST /api/admin/guest-messages — staff write to a guest about a booking, a suite
 * stay, an event sign-up, a loan, a hold or an order: `{ phone, text, about: { kind,
 * id } }`. The words go to the guest's messages on the site (their account, or the
 * phone until they sign in with it) and are activity-logged. Needs the permission
 * that manages what it's about (`GUEST_MESSAGE_PERMISSION`). 404 when that's gone,
 * 409 `GUEST_CHANGED` when its phone isn't the one sent. 201 with the message.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("dashboard.view");
  if (!session) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = guestMessageSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }
  if (!(await sessionHas(session, GUEST_MESSAGE_PERMISSION[parsed.data.about.kind]))) return unauthorizedResponse();

  try {
    const message = await new MessageGuest(
      {
        reservations: reservationRepository,
        suiteBookings: suiteBookingRepository,
        events: eventRepository,
        bookLoans: bookLoanRepository,
        bookHolds: bookWaitlistRepository,
        orders: orderRepository,
      },
      notificationRepository,
    ).execute(parsed.data, { id: session.user.id, name: session.user.name ?? session.user.id });
    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/admin/guest-messages failed");
  }
}
