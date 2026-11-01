import { NextResponse, type NextRequest } from "next/server";

import { billPeriodSchema } from "@/src/contracts/recurring-bill-schema";
import { SkipRecurringBill } from "@/src/domain/use-cases/expenses/RecurringBills";
import { recurringBillRepository } from "@/src/infrastructure/container";
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
 * POST /api/admin/recurring-bills/:id/skip — a month the bill doesn't apply, so it
 * stops being asked about. Books nothing. Requires `accounting.write`.
 */
export async function POST(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("accounting.write");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = billPeriodSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    await new SkipRecurringBill(recurringBillRepository).execute(id, parsed.data.period, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponseFromException(error, `POST /api/admin/recurring-bills/${id}/skip failed`);
  }
}
