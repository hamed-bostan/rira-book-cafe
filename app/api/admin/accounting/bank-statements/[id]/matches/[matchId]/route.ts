import { NextResponse } from "next/server";

import { UnmatchBankLines } from "@/src/domain/use-cases/accounting/BankReconciliation";
import { bankReconciliationRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

type RouteContext = { params: Promise<{ id: string; matchId: string }> };

/** DELETE /api/admin/accounting/bank-statements/:id/matches/:matchId — undo a match on an open statement. Requires `accounting.write`. */
export async function DELETE(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("accounting.write");
  if (!session) return unauthorizedResponse();
  const { id, matchId } = await params;
  try {
    await new UnmatchBankLines(bankReconciliationRepository).execute(id, matchId, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponseFromException(
      error,
      `DELETE /api/admin/accounting/bank-statements/${id}/matches/${matchId} failed`,
    );
  }
}
