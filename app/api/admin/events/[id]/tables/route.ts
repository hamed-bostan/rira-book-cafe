import { NextResponse, type NextRequest } from "next/server";

import { eventTablesSchema } from "@/src/contracts/event-schema";
import { HoldEventTables, ListEventTableOptions } from "@/src/domain/use-cases/events/EventTables";
import { eventRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/admin/events/:id/tables — every floor table, whether the event holds it, and what else has it then. */
export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  if (!(await getSessionWith("dashboard.view"))) return unauthorizedResponse();

  const { id } = await params;
  try {
    return NextResponse.json(await new ListEventTableOptions(eventRepository).execute(id));
  } catch (error) {
    return errorResponseFromException(error, `GET /api/admin/events/${id}/tables failed`);
  }
}

/** PUT /api/admin/events/:id/tables — replace the tables held for the event. Requires `events.manage`. */
export async function PUT(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("events.manage");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = eventTablesSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const event = await new HoldEventTables(eventRepository).execute(
      id,
      parsed.data.tableLabels,
      { id: session.user.id, name: session.user.name ?? session.user.id },
      new Date(),
    );
    return NextResponse.json(event);
  } catch (error) {
    return errorResponseFromException(error, `PUT /api/admin/events/${id}/tables failed`);
  }
}
