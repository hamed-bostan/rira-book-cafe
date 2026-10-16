import { NextResponse, type NextRequest } from "next/server";

import { FinancialReports } from "@/src/domain/use-cases/accounting/FinancialReports";
import { ledgerRepository } from "@/src/infrastructure/container";
import { parseDaySpan } from "@/src/lib/api/accounting-params";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ code: string }> };

/**
 * GET /api/admin/accounting/accounts/:code/ledger — one account's lines in a span
 * (`?from=&to=`, default the current Persian month) with opening, running and
 * closing balances. Requires `accounting.view`.
 */
export async function GET(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  if (!(await getSessionWith("accounting.view"))) return unauthorizedResponse();
  const { code } = await params;
  try {
    const { fromDay, toDay } = parseDaySpan(request.nextUrl.searchParams);
    return NextResponse.json(await new FinancialReports(ledgerRepository).accountLedger(code, fromDay, toDay));
  } catch (error) {
    return errorResponseFromException(error, `GET /api/admin/accounting/accounts/${code}/ledger failed`);
  }
}
