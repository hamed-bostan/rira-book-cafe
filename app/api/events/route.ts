import { NextResponse, type NextRequest } from "next/server";

import { eventFormSchema } from "@/src/contracts/event-schema";
import { EventQueries } from "@/src/domain/use-cases/events/EventRegistrations";
import { CreateEvent } from "@/src/domain/use-cases/events/SaveEvent";
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

/** GET /api/events — published events that haven't started, soonest first. Public. */
export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json(await new EventQueries(eventRepository).listUpcomingPublished(new Date()));
  } catch (error) {
    return errorResponseFromException(error, "GET /api/events failed");
  }
}

/** POST /api/events — create an event. Requires `events.manage`. */
async function handlePost(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("events.manage");
  if (!session) return unauthorizedResponse();

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
    const event = await new CreateEvent(eventRepository).execute(parsed.data, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/events failed");
  }
}

export const POST = invalidatesCatalog([CATALOG_TAGS.events], handlePost);
