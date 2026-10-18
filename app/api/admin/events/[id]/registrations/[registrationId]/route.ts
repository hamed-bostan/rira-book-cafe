import { NextResponse } from "next/server";

import { CancelRegistrationAsStaff } from "@/src/domain/use-cases/events/EventRegistrations";
import { eventRepository } from "@/src/infrastructure/container";
import { invalidatesCatalog } from "@/src/lib/api/invalidatesCatalog";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { CATALOG_TAGS } from "@/src/lib/cache-tags";
import { getSessionWith } from "@/src/lib/require-permission";

type RouteContext = { params: Promise<{ id: string; registrationId: string }> };

/** DELETE /api/admin/events/:id/registrations/:registrationId — cancel a guest's sign-up. Requires `events.manage`. */
async function handleDelete(_request: Request, { params }: RouteContext): Promise<NextResponse> {
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

export const DELETE = invalidatesCatalog([CATALOG_TAGS.events], handleDelete);
