import { type NextRequest } from "next/server";

import { FinancialReports } from "@/src/domain/use-cases/accounting/FinancialReports";
import { ledgerRepository } from "@/src/infrastructure/container";
import {
  accountingMessages,
  balanceSheetRows,
  marginRows,
  parseCsvLocale,
  profitAndLossRows,
  trialBalanceRows,
  vatRows,
} from "@/src/lib/api/accounting-csv";
import { parseAsOfDay, parseDaySpan } from "@/src/lib/api/accounting-params";
import { csvResponse } from "@/src/lib/api/csv-response";
import { errorResponse, errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ report: string }> };

/**
 * GET /api/admin/accounting/reports/:report/export — a financial statement as a CSV
 * download, in `?locale=`. Takes the same `?asOf=` or `?from=&to=` as the report
 * itself. Requires `accounting.view`.
 */
export async function GET(request: NextRequest, { params }: RouteContext): Promise<Response> {
  if (!(await getSessionWith("accounting.view"))) return unauthorizedResponse();
  const { report } = await params;
  const query = request.nextUrl.searchParams;
  const locale = parseCsvLocale(query);
  const reports = new FinancialReports(ledgerRepository);

  try {
    const messages = await accountingMessages(locale);
    switch (report) {
      case "trial-balance": {
        const asOf = parseAsOfDay(query);
        const rows = trialBalanceRows(await reports.trialBalance(asOf), messages, locale);
        return csvResponse(`trial-balance-${asOf}.csv`, rows);
      }
      case "balance-sheet": {
        const asOf = parseAsOfDay(query);
        const rows = balanceSheetRows(await reports.balanceSheet(asOf), messages, locale);
        return csvResponse(`balance-sheet-${asOf}.csv`, rows);
      }
      case "profit-and-loss": {
        const { fromDay, toDay } = parseDaySpan(query);
        const rows = profitAndLossRows(await reports.profitAndLoss(fromDay, toDay), messages, locale);
        return csvResponse(`profit-and-loss-${fromDay}-to-${toDay}.csv`, rows);
      }
      case "vat": {
        const { fromDay, toDay } = parseDaySpan(query);
        const rows = vatRows(await reports.vat(fromDay, toDay), messages, locale);
        return csvResponse(`vat-${fromDay}-to-${toDay}.csv`, rows);
      }
      case "margins": {
        const { fromDay, toDay } = parseDaySpan(query);
        const rows = marginRows(await reports.margins(fromDay, toDay), messages, locale);
        return csvResponse(`margins-${fromDay}-to-${toDay}.csv`, rows);
      }
      default:
        return errorResponse(404, { message: "No such report.", code: "NOT_FOUND" });
    }
  } catch (error) {
    return errorResponseFromException(error, `GET /api/admin/accounting/reports/${report}/export failed`);
  }
}
