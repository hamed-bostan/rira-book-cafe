import { NextResponse, type NextRequest } from "next/server";

import { eventFormSchema } from "@/src/contracts/event-schema";
import { EventQueries } from "@/src/domain/use-cases/events/EventRegistrations";
import { DeleteEvent, UpdateEvent } from "@/src/domain/use-cases/events/SaveEvent";
import { eventRepository } from "@/src/infrastructure/container";
import { invalidatesCatalog } from "@/src/lib/api/invalidatesCatalog";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { CATALOG_TAGS } from "@/src/lib/cache-tags";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/events/:id — one published event. Public; an unpublished one is 404. */
export async function GET(_request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const { id } = await params;
  try {
    const event = await new EventQueries(eventRepository).getPublished(id);
    if (!event) return errorResponse(404, { message: "Event not found.", code: "NOT_FOUND" });
    return NextResponse.json(event);
  } catch (error) {
    return errorResponseFromException(error, `GET /api/events/${id} failed`);
  }
}

/** PUT /api/events/:id — update an event. Requires `events.manage`. */
async function handlePut(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("events.manage");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = eventFormSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const event = await new UpdateEvent(eventRepository).execute(id, parsed.data, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(event);
  } catch (error) {
    return errorResponseFromException(error, `PUT /api/events/${id} failed`);
  }
}

/** DELETE /api/events/:id — delete an event with no active sign-ups (409 otherwise). Requires `events.manage`. */
async function handleDelete(_request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("events.manage");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  try {
    await new DeleteEvent(eventRepository).execute(id, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponseFromException(error, `DELETE /api/events/${id} failed`);
  }
}

export const PUT = invalidatesCatalog([CATALOG_TAGS.events], handlePut);
export const DELETE = invalidatesCatalog([CATALOG_TAGS.events], handleDelete);
