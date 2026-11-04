import { NextResponse, type NextRequest } from "next/server";

import { cafeTableMoveSchema } from "@/src/contracts/cafe-table-schema";
import { MoveCafeTable } from "@/src/domain/use-cases/settings/CafeTableCommands";
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
 * POST /api/admin/tables/:id/move — move a table one place along the floor order
 * (`{ direction: "up" | "down" }`), the order pickers list tables in. Requires
 * `settings.write`. 204; 400 when it's already first (or last); 404 when unknown.
 */
export async function POST(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("settings.write");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = cafeTableMoveSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    await new MoveCafeTable(cafeTableRepository).execute(id, parsed.data.direction, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponseFromException(error, `POST /api/admin/tables/${id}/move failed`);
  }
}
