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

type RouteContext = { params: Promise<{ id: string }> };

/** PUT /api/admin/payroll/employees/:id — edit someone or switch them off. Requires `payroll.manage`. */
export async function PUT(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("payroll.manage");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
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
    const employee = await new SaveEmployee(payrollRepository).update(id, parsed.data, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(employee);
  } catch (error) {
    return errorResponseFromException(error, `PUT /api/admin/payroll/employees/${id} failed`);
  }
}
