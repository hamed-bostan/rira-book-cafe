import { NextResponse, type NextRequest } from "next/server";

import { cafeTableSchema } from "@/src/contracts/cafe-table-schema";
import { AddCafeTable, ListCafeTables } from "@/src/domain/use-cases/settings/CafeTableCommands";
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

/** GET /api/admin/tables — every table on the floor, in use or not, in floor order. Requires `dashboard.view`. */
export async function GET(): Promise<NextResponse> {
  if (!(await getSessionWith("dashboard.view"))) return unauthorizedResponse();
  try {
    return NextResponse.json(await new ListCafeTables(cafeTableRepository).execute());
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/tables failed");
  }
}

/**
 * POST /api/admin/tables — add a table at the end of the floor. Requires
 * `settings.write`. 201 with the table; 409 (`label`) when the label is taken.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("settings.write");
  if (!session) return unauthorizedResponse();

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
    const table = await new AddCafeTable(cafeTableRepository).execute(parsed.data, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(table, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/admin/tables failed");
  }
}
