import { NextResponse } from "next/server";

import { CancelOwnRegistration } from "@/src/domain/use-cases/events/EventRegistrations";
import { eventRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getUserSession } from "@/src/lib/require-auth";

type RouteContext = { params: Promise<{ id: string }> };

/** DELETE /api/event-registrations/:id — the guest cancels their own sign-up. 404 for anyone else's. */
export async function DELETE(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const session = await getUserSession();
  if (!session?.user.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    return NextResponse.json(await new CancelOwnRegistration(eventRepository).execute(id, session.user.id));
  } catch (error) {
    return errorResponseFromException(error, `DELETE /api/event-registrations/${id} failed`);
  }
}
