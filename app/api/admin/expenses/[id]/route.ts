import { NextResponse } from "next/server";

import { expenseRepository, ledgerRepository } from "@/src/infrastructure/container";
import { errorResponse, errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/admin/expenses/:id — one expense and the journal entries it posted. Requires `accounting.view`. */
export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  if (!(await getSessionWith("accounting.view"))) return unauthorizedResponse();
  const { id } = await params;
  try {
    const [expense, entries] = await Promise.all([expenseRepository.getExpense(id), ledgerRepository.entriesFor(id)]);
    if (!expense) return errorResponse(404, { message: "Expense not found.", code: "NOT_FOUND" });
    return NextResponse.json({ expense, entries });
  } catch (error) {
    return errorResponseFromException(error, `GET /api/admin/expenses/${id} failed`);
  }
}
