import { NextResponse, type NextRequest } from "next/server";

import { payRunSchema } from "@/src/contracts/payroll-schema";
import { RecordPayRun } from "@/src/domain/use-cases/payroll/PayrollCommands";
import { payrollRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/** GET /api/admin/payroll/runs — every pay run, newest month first. Requires `payroll.manage`. */
export async function GET(): Promise<NextResponse> {
  if (!(await getSessionWith("payroll.manage"))) return unauthorizedResponse();
  try {
    return NextResponse.json(await payrollRepository.listRuns());
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/payroll/runs failed");
  }
}

/**
 * POST /api/admin/payroll/runs — record a month's pay and book it. A month that
 * already has a standing run answers 409 and books nothing. Requires `payroll.manage`.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("payroll.manage");
  if (!session) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = payRunSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const run = await new RecordPayRun(payrollRepository).execute(parsed.data, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(run, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/admin/payroll/runs failed");
  }
}
