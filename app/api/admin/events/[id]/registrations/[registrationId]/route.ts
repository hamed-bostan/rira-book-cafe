import { NextResponse } from "next/server";

import { CancelRegistrationAsStaff } from "@/src/domain/use-cases/events/EventRegistrations";
import { eventRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

type RouteContext = { params: Promise<{ id: string; registrationId: string }> };

/** DELETE /api/admin/events/:id/registrations/:registrationId — cancel a guest's sign-up. Requires `events.manage`. */
export async function DELETE(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("events.manage");
  if (!session) return unauthorizedResponse();

  const { id, registrationId } = await params;
  try {
    const registration = await new CancelRegistrationAsStaff(eventRepository).execute(id, registrationId, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(registration);
  } catch (error) {
    return errorResponseFromException(error, `DELETE /api/admin/events/${id}/registrations/${registrationId} failed`);
  }
}
