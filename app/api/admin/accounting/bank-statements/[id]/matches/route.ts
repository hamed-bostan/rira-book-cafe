import { NextResponse, type NextRequest } from "next/server";

import { bankMatchSchema } from "@/src/contracts/bank-schema";
import { MatchBankLines } from "@/src/domain/use-cases/accounting/BankReconciliation";
import { bankReconciliationRepository } from "@/src/infrastructure/container";
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
 * POST /api/admin/accounting/bank-statements/:id/matches — match statement lines to
 * ledger lines on the Bank account whose totals agree (409 `MATCH_UNBALANCED` /
 * `ALREADY_MATCHED`). Requires `accounting.write`.
 */
export async function POST(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("accounting.write");
  if (!session) return unauthorizedResponse();
  const { id } = await params;

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = bankMatchSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Pick lines on both sides.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    await new MatchBankLines(bankReconciliationRepository).execute(id, parsed.data, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponseFromException(error, `POST /api/admin/accounting/bank-statements/${id}/matches failed`);
  }
}
