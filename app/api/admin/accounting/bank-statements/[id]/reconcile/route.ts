import { NextResponse } from "next/server";

import { ReconcileBankStatement } from "@/src/domain/use-cases/accounting/BankReconciliation";
import { bankReconciliationRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/accounting/bank-statements/:id/reconcile — sign the statement off
 * once every line is matched and the adjusted book balance equals its closing
 * balance (409 `NOT_RECONCILED` / `PREVIOUS_NOT_RECONCILED`). Requires `accounting.write`.
 */
export async function POST(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("accounting.write");
  if (!session) return unauthorizedResponse();
  const { id } = await params;
  try {
    const statement = await new ReconcileBankStatement(bankReconciliationRepository).execute(id, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(statement);
  } catch (error) {
    return errorResponseFromException(error, `POST /api/admin/accounting/bank-statements/${id}/reconcile failed`);
  }
}
