import { NextResponse, type NextRequest } from "next/server";

import { statementLinesSchema } from "@/src/contracts/bank-schema";
import { AddStatementLines } from "@/src/domain/use-cases/accounting/BankReconciliation";
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

/** POST /api/admin/accounting/bank-statements/:id/lines — add lines to an open statement. Requires `accounting.write`. */
export async function POST(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("accounting.write");
  if (!session) return unauthorizedResponse();
  const { id } = await params;

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = statementLinesSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const statement = await new AddStatementLines(bankReconciliationRepository).execute(id, parsed.data.lines, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(statement, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, `POST /api/admin/accounting/bank-statements/${id}/lines failed`);
  }
}
