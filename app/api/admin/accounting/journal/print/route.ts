import { NextResponse, type NextRequest } from "next/server";

import { FinancialReports } from "@/src/domain/use-cases/accounting/FinancialReports";
import { ledgerRepository } from "@/src/infrastructure/container";
import { parseDaySpan, parseJournalFilters } from "@/src/lib/api/accounting-params";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/accounting/journal/print — the journal over a span for printing,
 * oldest first and not paged, up to a limit `total` shows was reached. `?from=&to=`
 * default to the current Persian month; `?source=` and `?account=` narrow it.
 * Requires `accounting.view`.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await getSessionWith("accounting.view"))) return unauthorizedResponse();
  const query = request.nextUrl.searchParams;

  try {
    const { fromDay, toDay } = parseDaySpan(query);
    const { source, accountCode } = parseJournalFilters(query);
    const journal = await new FinancialReports(ledgerRepository).printedJournal(fromDay, toDay, {
      source,
      accountCode,
    });
    return NextResponse.json(journal);
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/accounting/journal/print failed");
  }
}
