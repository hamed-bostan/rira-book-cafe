import { NextResponse } from "next/server";

import { AutoMatchBankLines } from "@/src/domain/use-cases/accounting/BankReconciliation";
import { bankReconciliationRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/accounting/bank-statements/:id/auto-match — make every safe
 * one-to-one match (same amount, within a week, no other candidate). Answers
 * `{ matched }`. Requires `accounting.write`.
 */
export async function POST(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("accounting.write");
  if (!session) return unauthorizedResponse();
  const { id } = await params;
  try {
    const matched = await new AutoMatchBankLines(bankReconciliationRepository).execute(id, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json({ matched });
  } catch (error) {
    return errorResponseFromException(error, `POST /api/admin/accounting/bank-statements/${id}/auto-match failed`);
  }
}
