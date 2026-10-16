import { NextResponse } from "next/server";

import { EventQueries } from "@/src/domain/use-cases/events/EventRegistrations";
import { eventRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/** GET /api/admin/events — every event in any state, newest start first, with seats taken. */
export async function GET(): Promise<NextResponse> {
  if (!(await getSessionWith("dashboard.view"))) return unauthorizedResponse();

  try {
    return NextResponse.json(await new EventQueries(eventRepository).listAll());
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/events failed");
  }
}
