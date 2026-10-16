import { NextResponse } from "next/server";

import { EventQueries } from "@/src/domain/use-cases/events/EventRegistrations";
import { eventRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getUserSession } from "@/src/lib/require-auth";

export const dynamic = "force-dynamic";

/** GET /api/event-registrations — the signed-in guest's own sign-ups, newest first. */
export async function GET(): Promise<NextResponse> {
  const session = await getUserSession();
  if (!session?.user.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await new EventQueries(eventRepository).listRegistrationsForUser(session.user.id));
  } catch (error) {
    return errorResponseFromException(error, "GET /api/event-registrations failed");
  }
}
