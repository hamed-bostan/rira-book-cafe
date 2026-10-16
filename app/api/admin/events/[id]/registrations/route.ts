import { NextResponse } from "next/server";

import { EventQueries } from "@/src/domain/use-cases/events/EventRegistrations";
import { eventRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/admin/events/:id/registrations — the guest list, oldest sign-up first. */
export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  if (!(await getSessionWith("dashboard.view"))) return unauthorizedResponse();

  const { id } = await params;
  try {
    return NextResponse.json(await new EventQueries(eventRepository).listRegistrations(id));
  } catch (error) {
    return errorResponseFromException(error, `GET /api/admin/events/${id}/registrations failed`);
  }
}
