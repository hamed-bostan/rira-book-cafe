import { NextResponse, type NextRequest } from "next/server";

import { voidExpenseSchema } from "@/src/contracts/expense-schema";
import { VoidPayRun } from "@/src/domain/use-cases/payroll/PayrollCommands";
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
 * POST /api/admin/payroll/runs/:id/void — void a run recorded by mistake: its entries
 * are reversed today, never deleted, and its month is free again. Requires `payroll.manage`.
 */
export async function POST(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("payroll.manage");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = voidExpenseSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const run = await new VoidPayRun(payrollRepository).execute(id, parsed.data.reason, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(run);
  } catch (error) {
    return errorResponseFromException(error, `POST /api/admin/payroll/runs/${id}/void failed`);
  }
}
