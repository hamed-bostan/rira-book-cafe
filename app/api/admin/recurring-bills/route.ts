import { NextResponse, type NextRequest } from "next/server";

import { recurringBillSchema } from "@/src/contracts/recurring-bill-schema";
import { SaveRecurringBill } from "@/src/domain/use-cases/expenses/RecurringBills";
import { ledgerRepository, recurringBillRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/** GET /api/admin/recurring-bills — every recurring bill, switched off or not. Requires `accounting.view`. */
export async function GET(): Promise<NextResponse> {
  if (!(await getSessionWith("accounting.view"))) return unauthorizedResponse();
  try {
    return NextResponse.json(await recurringBillRepository.list());
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/recurring-bills failed");
  }
}

/**
 * POST /api/admin/recurring-bills — set up a bill that comes round every Persian
 * month. Books nothing: each month waits for someone. Requires `accounting.write`.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("accounting.write");
  if (!session) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = recurringBillSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const bill = await new SaveRecurringBill(recurringBillRepository, ledgerRepository).create(parsed.data, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(bill, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/admin/recurring-bills failed");
  }
}
