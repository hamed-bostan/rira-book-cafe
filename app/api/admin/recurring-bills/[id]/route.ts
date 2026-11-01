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

type RouteContext = { params: Promise<{ id: string }> };

/** PUT /api/admin/recurring-bills/:id — edit a bill or switch it off. Requires `accounting.write`. */
export async function PUT(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("accounting.write");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
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
    const bill = await new SaveRecurringBill(recurringBillRepository, ledgerRepository).update(id, parsed.data, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(bill);
  } catch (error) {
    return errorResponseFromException(error, `PUT /api/admin/recurring-bills/${id} failed`);
  }
}
