import { NextResponse, type NextRequest } from "next/server";

import { voidExpenseSchema } from "@/src/contracts/expense-schema";
import { VoidExpense } from "@/src/domain/use-cases/expenses/ExpenseCommands";
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

/**
 * POST /api/admin/expenses/:id/void — void an expense entered by mistake; its
 * entries are reversed today, never deleted. Requires `accounting.write`.
 */
export async function POST(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("accounting.write");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = voidExpenseSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, { message: "Please fix the highlighted fields.", code: "VALIDATION", fieldErrors: firstFieldErrors(parsed.error) });
  }

  try {
    const expense = await new VoidExpense(expenseRepository).execute(id, parsed.data.reason, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(expense);
  } catch (error) {
    return errorResponseFromException(error, `POST /api/admin/expenses/${id}/void failed`);
  }
}
