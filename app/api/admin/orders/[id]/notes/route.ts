import { NextResponse, type NextRequest } from "next/server";

import { orderNoteSchema } from "@/src/contracts/order-note-schema";
import { AddOrderNote } from "@/src/domain/use-cases/orders/AddOrderNote";
import { ListOrderNotes } from "@/src/domain/use-cases/orders/ListOrderNotes";
import { orderNoteRepository, orderRepository } from "@/src/infrastructure/container";
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

/**
 * GET /api/admin/orders/:id/notes — one order's internal notes, newest first.
 *
 * `dashboard.view` rather than `orders.note`: reading the notes is part of reading
 * the order, and everyone who can open the order needs the context they hold. It's
 * *writing* one that's the narrower permission — though every dashboard role
 * happens to have it, since leaving a note is the one write support can make.
 */
export async function GET(_request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  if (!(await getSessionWith("dashboard.view"))) return unauthorizedResponse();

  const { id } = await params;
  try {
    const notes = await new ListOrderNotes(orderNoteRepository).execute(id);
    return NextResponse.json(notes);
  } catch (error) {
    return errorResponseFromException(error, `GET /api/admin/orders/${id}/notes failed`);
  }
}

/**
 * POST /api/admin/orders/:id/notes — append an internal note. Requires
 * `orders.note`. 404 when the order doesn't exist; notes are append-only, so one
 * attached to a nonexistent order could never be cleaned up.
 *
 * Nothing here is ever shown to the guest.
 */
export async function POST(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("orders.note");
  if (!session) return unauthorizedResponse();

  const { id } = await params;

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = orderNoteSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    // The author comes from the session, never from the body — a note whose author
    // the client could choose would be worthless as a record of who knew what.
    const note = await new AddOrderNote(orderNoteRepository, orderRepository).execute(id, parsed.data.body, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, `POST /api/admin/orders/${id}/notes failed`);
  }
}
