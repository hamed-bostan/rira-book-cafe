import { NextResponse } from "next/server";

import { GetBankReconciliation } from "@/src/domain/use-cases/accounting/BankReconciliation";
import { bankReconciliationRepository } from "@/src/infrastructure/container";
import { errorResponse, errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/accounting/bank-statements/:id — the statement, the ledger lines
 * it can match, the reconciliation proof and safe match suggestions. Requires
 * `accounting.view`.
 */
export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  if (!(await getSessionWith("accounting.view"))) return unauthorizedResponse();
  const { id } = await params;
  try {
    const view = await new GetBankReconciliation(bankReconciliationRepository).execute(id);
    if (!view) return errorResponse(404, { message: "Bank statement not found.", code: "NOT_FOUND" });
    return NextResponse.json(view);
  } catch (error) {
    return errorResponseFromException(error, `GET /api/admin/accounting/bank-statements/${id} failed`);
  }
}
