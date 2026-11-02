import { NextResponse, type NextRequest } from "next/server";

import { payExpenseSchema } from "@/src/contracts/expense-schema";
import { PayPayRun } from "@/src/domain/use-cases/payroll/PayrollCommands";
import { payrollRepository } from "@/src/infrastructure/container";
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
 * POST /api/admin/payroll/runs/:id/pay — pay out some or all of a run from cash or the
 * bank; a blank amount pays all that's left. Requires `payroll.manage`.
 */
export async function POST(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("payroll.manage");
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
    const { source, paidOn, amount } = parsed.data;
    const run = await new PayPayRun(payrollRepository).execute(
      id,
      { source, paidOn, amount: amount > 0 ? amount : undefined },
      { id: session.user.id, name: session.user.name ?? session.user.id },
    );
    return NextResponse.json(run);
  } catch (error) {
    return errorResponseFromException(error, `POST /api/admin/payroll/runs/${id}/pay failed`);
  }
}
