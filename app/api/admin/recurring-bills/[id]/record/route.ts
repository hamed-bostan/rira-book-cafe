import { NextResponse, type NextRequest } from "next/server";

import { expenseSchema } from "@/src/contracts/expense-schema";
import { billPeriodSchema } from "@/src/contracts/recurring-bill-schema";
import { RecordRecurringBill } from "@/src/domain/use-cases/expenses/RecurringBills";
import { expenseRepository, ledgerRepository, recurringBillRepository } from "@/src/infrastructure/container";
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
 * POST /api/admin/recurring-bills/:id/record — someone books a month of a bill: the
 * body is an expense, plus the `period`, with the figures as they really came. A
 * month already dealt with answers 409 and books nothing. Requires `accounting.write`.
 */
export async function POST(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("accounting.write");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const period = billPeriodSchema.safeParse(body.data);
  const expense = expenseSchema.safeParse(body.data);
  if (!period.success || !expense.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: {
        ...(period.success ? {} : firstFieldErrors(period.error)),
        ...(expense.success ? {} : firstFieldErrors(expense.error)),
      },
    });
  }

  try {
    const recorded = await new RecordRecurringBill(
      recurringBillRepository,
      expenseRepository,
      ledgerRepository,
    ).execute(id, period.data.period, expense.data, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(recorded, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, `POST /api/admin/recurring-bills/${id}/record failed`);
  }
}
