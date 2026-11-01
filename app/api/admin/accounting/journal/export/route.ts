import { type NextRequest } from "next/server";

import { ledgerRepository } from "@/src/infrastructure/container";
import { accountingMessages, journalCsv, parseCsvLocale } from "@/src/lib/api/accounting-csv";
import { parseDaySpan, parseJournalFilters } from "@/src/lib/api/accounting-params";
import { csvStreamResponse } from "@/src/lib/api/csv-response";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/accounting/journal/export — the journal over a span as a CSV
 * download, oldest first, one row per line, in `?locale=`. `?from=&to=` default to
 * the current Persian month; `?source=` and `?account=` narrow it as on the journal.
 * Streamed, so a long span costs no more memory than a short one. Requires
 * `accounting.view`.
 */
export async function GET(request: NextRequest): Promise<Response> {
  if (!(await getSessionWith("accounting.view"))) return unauthorizedResponse();
  const query = request.nextUrl.searchParams;
  const locale = parseCsvLocale(query);

  try {
    const { fromDay, toDay } = parseDaySpan(query);
    const [accounts, messages] = await Promise.all([ledgerRepository.listAccounts(), accountingMessages(locale)]);
    const batches = ledgerRepository.entryBatches({ ...parseJournalFilters(query), fromDay, toDay });
    return csvStreamResponse(`journal-${fromDay}-to-${toDay}.csv`, journalCsv(batches, accounts, messages, locale));
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/accounting/journal/export failed");
  }
}
