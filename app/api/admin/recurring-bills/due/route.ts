import { NextResponse } from "next/server";

import { ListDueBills } from "@/src/domain/use-cases/expenses/RecurringBills";
import { recurringBillRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/recurring-bills/due — months of recurring bills that have fallen
 * due and nobody has recorded or skipped, oldest first. Requires `accounting.view`.
 */
export async function GET(): Promise<NextResponse> {
  if (!(await getSessionWith("accounting.view"))) return unauthorizedResponse();
  try {
    return NextResponse.json(await new ListDueBills(recurringBillRepository).execute());
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/recurring-bills/due failed");
  }
}
