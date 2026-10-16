import { NextResponse, type NextRequest } from "next/server";

import { supplierSchema } from "@/src/contracts/expense-schema";
import { SaveSupplier } from "@/src/domain/use-cases/expenses/ExpenseCommands";
import { expenseRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/** GET /api/admin/suppliers — suppliers by name; `?all=true` includes inactive ones. Requires `accounting.view`. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await getSessionWith("accounting.view"))) return unauthorizedResponse();
  try {
    return NextResponse.json(await expenseRepository.listSuppliers(request.nextUrl.searchParams.get("all") === "true"));
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/suppliers failed");
  }
}

/** POST /api/admin/suppliers — add a supplier. Requires `accounting.write`. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await getSessionWith("accounting.write"))) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = supplierSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, { message: "Please fix the highlighted fields.", code: "VALIDATION", fieldErrors: firstFieldErrors(parsed.error) });
  }

  try {
    return NextResponse.json(await new SaveSupplier(expenseRepository).create(parsed.data), { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/admin/suppliers failed");
  }
}
