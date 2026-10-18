import { NextResponse, type NextRequest } from "next/server";

import { payExpenseSchema } from "@/src/contracts/expense-schema";
import { PayExpense } from "@/src/domain/use-cases/expenses/ExpenseCommands";
import { expenseRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

type RouteContext = { params: Promise<{ id: string }> };

/** POST /api/admin/expenses/:id/pay — pay an owed expense from cash or the bank. Requires `accounting.write`. */
export async function POST(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("accounting.write");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = payExpenseSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const expense = await new PayExpense(expenseRepository).execute(id, parsed.data.source, parsed.data.paidOn, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(expense);
  } catch (error) {
    return errorResponseFromException(error, `POST /api/admin/expenses/${id}/pay failed`);
  }
}
