import { NextResponse, type NextRequest } from "next/server";

import { expenseSchema } from "@/src/contracts/expense-schema";
import { RecordExpense } from "@/src/domain/use-cases/expenses/ExpenseCommands";
import { expenseRepository, ledgerRepository } from "@/src/infrastructure/container";
import { parseExpenseFilters } from "@/src/lib/api/accounting-params";
import { parsePageRequest } from "@/src/lib/api/pagination-params";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/expenses — expenses, newest first, one page at a time, plus what's
 * owed to suppliers right now (`totalUnpaid`). Filters: `?from=&to=`, `?status=`,
 * `?supplier=`, `?account=`. Requires `accounting.view`.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await getSessionWith("accounting.view"))) return unauthorizedResponse();
  try {
    const params = request.nextUrl.searchParams;
    const [page, totalUnpaid] = await Promise.all([
      expenseRepository.listExpenses(parseExpenseFilters(params), parsePageRequest(params, [])),
      expenseRepository.totalUnpaid(),
    ]);
    return NextResponse.json({ ...page, totalUnpaid });
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/expenses failed");
  }
}

/** POST /api/admin/expenses — record a bill or purchase and book it. Requires `accounting.write`. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("accounting.write");
  if (!session) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = expenseSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const expense = await new RecordExpense(expenseRepository, ledgerRepository).execute(parsed.data, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/admin/expenses failed");
  }
}
