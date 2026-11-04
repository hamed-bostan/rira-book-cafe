import { NextResponse, type NextRequest } from "next/server";

import { cafeTableSchema } from "@/src/contracts/cafe-table-schema";
import { EditCafeTable, RemoveCafeTable } from "@/src/domain/use-cases/settings/CafeTableCommands";
import { cafeTableRepository } from "@/src/infrastructure/container";
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
 * PUT /api/admin/tables/:id — change a table's label, seats, area or whether it's
 * in use. A new label is carried onto its bookings and event holds. Requires
 * `settings.write`. 404 for an unknown table; 409 (`label`) when the label is taken.
 */
export async function PUT(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("settings.write");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = cafeTableSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const table = await new EditCafeTable(cafeTableRepository).execute(id, parsed.data, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(table);
  } catch (error) {
    return errorResponseFromException(error, `PUT /api/admin/tables/${id} failed`);
  }
}

/**
 * DELETE /api/admin/tables/:id — remove a table for good. Requires
 * `settings.write`. 204; 409 `IN_USE` while an open order is at it or a booking
 * or event still holds it ahead (take it out of use instead); 404 when unknown.
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("settings.write");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  try {
    await new RemoveCafeTable(cafeTableRepository).execute(
      id,
      { id: session.user.id, name: session.user.name ?? session.user.id },
      new Date(),
    );
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponseFromException(error, `DELETE /api/admin/tables/${id} failed`);
  }
}
