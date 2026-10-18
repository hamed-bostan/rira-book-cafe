import { NextResponse, type NextRequest } from "next/server";

import { recordStatementLineSchema } from "@/src/contracts/bank-schema";
import { RecordStatementLine } from "@/src/domain/use-cases/accounting/BankReconciliation";
import { bankReconciliationRepository, ledgerRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

type RouteContext = { params: Promise<{ id: string; lineId: string }> };

/**
 * POST /api/admin/accounting/bank-statements/:id/lines/:lineId/record — book what
 * the line shows the bank did (a fee, interest, a gateway payout) and match it, in
 * one transaction. Requires `accounting.write`.
 */
export async function POST(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("accounting.write");
  if (!session) return unauthorizedResponse();
  const { id, lineId } = await params;

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = recordStatementLineSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const entry = await new RecordStatementLine(bankReconciliationRepository, ledgerRepository).execute(
      id,
      lineId,
      parsed.data,
      {
        id: session.user.id,
        name: session.user.name ?? session.user.id,
      },
    );
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    return errorResponseFromException(
      error,
      `POST /api/admin/accounting/bank-statements/${id}/lines/${lineId}/record failed`,
    );
  }
}
