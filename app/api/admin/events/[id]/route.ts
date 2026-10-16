import { NextResponse } from "next/server";

import { EventQueries } from "@/src/domain/use-cases/events/EventRegistrations";
import { eventRepository } from "@/src/infrastructure/container";
import { errorResponse, errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/admin/events/:id — one event in any state, for the edit screen. */
export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  if (!(await getSessionWith("dashboard.view"))) return unauthorizedResponse();

  const { id } = await params;
  try {
    const event = await new EventQueries(eventRepository).getById(id);
    if (!event) return errorResponse(404, { message: "Event not found.", code: "NOT_FOUND" });
    return NextResponse.json(event);
  } catch (error) {
    return errorResponseFromException(error, `GET /api/admin/events/${id} failed`);
  }
}
