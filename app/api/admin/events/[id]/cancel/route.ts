import { NextResponse } from "next/server";

import { CancelEvent } from "@/src/domain/use-cases/events/CancelEvent";
import { customerNotifier, eventRepository } from "@/src/infrastructure/container";
import { invalidatesCatalog } from "@/src/lib/api/invalidatesCatalog";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { CATALOG_TAGS } from "@/src/lib/cache-tags";
import { getSessionWith } from "@/src/lib/require-permission";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/events/:id/cancel — call the event off: cancel every sign-up,
 * unpublish it, and tell each guest. Requires `events.manage`. 409 `EVENT_CLOSED`
 * once the event has ended. Returns the event as it's left.
 */
async function handlePost(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("events.manage");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  try {
    const event = await new CancelEvent(eventRepository, customerNotifier).execute(
      id,
      { id: session.user.id, name: session.user.name ?? session.user.id },
      new Date(),
    );
    return NextResponse.json(event);
  } catch (error) {
    return errorResponseFromException(error, `POST /api/admin/events/${id}/cancel failed`);
  }
}

export const POST = invalidatesCatalog([CATALOG_TAGS.events], handlePost);
