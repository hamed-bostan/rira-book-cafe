import { NextResponse } from "next/server";

import { RemoveStatementLine } from "@/src/domain/use-cases/accounting/BankReconciliation";
import { bankReconciliationRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

type RouteContext = { params: Promise<{ id: string; lineId: string }> };

/** DELETE /api/admin/accounting/bank-statements/:id/lines/:lineId — remove an unmatched line from an open statement. Requires `accounting.write`. */
export async function DELETE(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("accounting.write");
  if (!session) return unauthorizedResponse();
  const { id, lineId } = await params;
  try {
    await new RemoveStatementLine(bankReconciliationRepository).execute(id, lineId, { id: session.user.id, name: session.user.name ?? session.user.id });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponseFromException(error, `DELETE /api/admin/accounting/bank-statements/${id}/lines/${lineId} failed`);
  }
}
