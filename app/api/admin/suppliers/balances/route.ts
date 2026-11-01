import { NextResponse } from "next/server";

import { GetSupplierBalances } from "@/src/domain/use-cases/expenses/ExpenseQueries";
import { expenseRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/suppliers/balances — what's left to pay each supplier, part
 * payments taken off, and what's owed on bills with no supplier named. Requires
 * `accounting.view`.
 */
export async function GET(): Promise<NextResponse> {
  if (!(await getSessionWith("accounting.view"))) return unauthorizedResponse();
  try {
    return NextResponse.json(await new GetSupplierBalances(expenseRepository).execute());
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/suppliers/balances failed");
  }
}
