import { NextResponse, type NextRequest } from "next/server";

import { eventRegistrationSchema } from "@/src/contracts/event-schema";
import { RegisterForEvent } from "@/src/domain/use-cases/events/EventRegistrations";
import { eventRepository, userRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getUserSession } from "@/src/lib/require-auth";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/events/:id/registrations — the signed-in guest signs up. 201 with the
 * registration; 409 when the event is full, closed, or they're already in.
 */
export async function POST(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getUserSession();
  if (!session?.user.id) return unauthorizedResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = eventRegistrationSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const guest = await userRepository.getById(session.user.id);
    if (!guest) return unauthorizedResponse();

    const registration = await new RegisterForEvent(eventRepository).execute(id, parsed.data.seats, guest, new Date());
    return NextResponse.json(registration, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, `POST /api/events/${id}/registrations failed`);
  }
}
