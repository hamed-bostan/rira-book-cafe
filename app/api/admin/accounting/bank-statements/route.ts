import { NextResponse, type NextRequest } from "next/server";

import { bankStatementSchema } from "@/src/contracts/bank-schema";
import { CreateBankStatement, ListBankStatements } from "@/src/domain/use-cases/accounting/BankReconciliation";
import { bankReconciliationRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/** GET /api/admin/accounting/bank-statements — statements, newest period first, with match progress. Requires `accounting.view`. */
export async function GET(): Promise<NextResponse> {
  if (!(await getSessionWith("accounting.view"))) return unauthorizedResponse();
  try {
    return NextResponse.json(await new ListBankStatements(bankReconciliationRepository).execute());
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/accounting/bank-statements failed");
  }
}

/**
 * POST /api/admin/accounting/bank-statements — enter a statement for a period with
 * its balances and lines. It must start after the previous statement and open at
 * its closing balance (409 `STATEMENT_OVERLAP`, 400 on `openingBalance`).
 * Requires `accounting.write`.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("accounting.write");
  if (!session) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = bankStatementSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, { message: "Please fix the highlighted fields.", code: "VALIDATION", fieldErrors: firstFieldErrors(parsed.error) });
  }

  try {
    const statement = await new CreateBankStatement(bankReconciliationRepository).execute(parsed.data, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(statement, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/admin/accounting/bank-statements failed");
  }
}
