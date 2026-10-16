import { NextResponse } from "next/server";

import { ledgerRepository } from "@/src/infrastructure/container";
import { errorResponse, errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/admin/accounting/journal/:id — one entry with its lines. Requires `accounting.view`. */
export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  if (!(await getSessionWith("accounting.view"))) return unauthorizedResponse();
  const { id } = await params;
  try {
    const entry = await ledgerRepository.getEntry(id);
    if (!entry) return errorResponse(404, { message: "Journal entry not found.", code: "NOT_FOUND" });
    return NextResponse.json(entry);
  } catch (error) {
    return errorResponseFromException(error, `GET /api/admin/accounting/journal/${id} failed`);
  }
}
