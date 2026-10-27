import { NextResponse } from "next/server";

import { GetExpenseSummary } from "@/src/domain/use-cases/expenses/ExpenseQueries";
import { expenseRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/expenses/summary — what's owed to suppliers now, what was
 * recorded in the current Persian month, and how many expenses sit in each status.
 * Requires `accounting.view`.
 */
export async function GET(): Promise<NextResponse> {
  if (!(await getSessionWith("accounting.view"))) return unauthorizedResponse();
  try {
    return NextResponse.json(await new GetExpenseSummary(expenseRepository).execute());
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/expenses/summary failed");
  }
}
