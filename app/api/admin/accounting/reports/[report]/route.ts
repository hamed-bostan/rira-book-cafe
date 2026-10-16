import { NextResponse, type NextRequest } from "next/server";

import { FinancialReports } from "@/src/domain/use-cases/accounting/FinancialReports";
import { ledgerRepository } from "@/src/infrastructure/container";
import { parseAsOfDay, parseDaySpan } from "@/src/lib/api/accounting-params";
import { errorResponse, errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ report: string }> };

/**
 * GET /api/admin/accounting/reports/:report — a financial statement from the ledger.
 *   trial-balance, balance-sheet   → `?asOf=` (default today)
 *   profit-and-loss, vat, margins  → `?from=&to=` (default the current Persian month)
 * Requires `accounting.view`.
 */
export async function GET(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  if (!(await getSessionWith("accounting.view"))) return unauthorizedResponse();
  const { report } = await params;
  const query = request.nextUrl.searchParams;
  const reports = new FinancialReports(ledgerRepository);

  try {
    switch (report) {
      case "trial-balance":
        return NextResponse.json(await reports.trialBalance(parseAsOfDay(query)));
      case "balance-sheet":
        return NextResponse.json(await reports.balanceSheet(parseAsOfDay(query)));
      case "profit-and-loss": {
        const { fromDay, toDay } = parseDaySpan(query);
        return NextResponse.json(await reports.profitAndLoss(fromDay, toDay));
      }
      case "vat": {
        const { fromDay, toDay } = parseDaySpan(query);
        return NextResponse.json(await reports.vat(fromDay, toDay));
      }
      case "margins": {
        const { fromDay, toDay } = parseDaySpan(query);
        return NextResponse.json(await reports.margins(fromDay, toDay));
      }
      default:
        return errorResponse(404, { message: "No such report.", code: "NOT_FOUND" });
    }
  } catch (error) {
    return errorResponseFromException(error, `GET /api/admin/accounting/reports/${report} failed`);
  }
}
