import { NextResponse, type NextRequest } from "next/server";

import { employeeSchema } from "@/src/contracts/payroll-schema";
import { SaveEmployee } from "@/src/domain/use-cases/payroll/PayrollCommands";
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

/** GET /api/admin/payroll/employees — everyone by name; `?all=true` includes those switched off. Requires `payroll.manage`. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await getSessionWith("payroll.manage"))) return unauthorizedResponse();
  try {
    return NextResponse.json(await payrollRepository.listEmployees(request.nextUrl.searchParams.get("all") === "true"));
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/payroll/employees failed");
  }
}

/** POST /api/admin/payroll/employees — add someone to the payroll. Requires `payroll.manage`. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("payroll.manage");
  if (!session) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = employeeSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const employee = await new SaveEmployee(payrollRepository).create(parsed.data, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/admin/payroll/employees failed");
  }
}
