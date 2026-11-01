import { buildJournalParams, parseDaySpan, parseJournalFilters } from "@/src/lib/api/accounting-params";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { requirePermission } from "@/src/lib/require-permission";
import {
  accountsServerApi,
  journalEntriesServerApi,
} from "@/src/presentation/dashboard/accounting/accounting-server-api";
import { JournalPrintScreen } from "@/src/presentation/dashboard/accounting/JournalPrintScreen";

export const dynamic = "force-dynamic";

type JournalPrintPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function JournalPrintPage({ searchParams }: JournalPrintPageProps) {
  await requirePermission("accounting.view");
  const params = toSearchParams(await searchParams);
  const { fromDay, toDay } = parseDaySpan(params);
  const { source, accountCode } = parseJournalFilters(params);
  const filters = Object.fromEntries(buildJournalParams({ source, accountCode }));

  const [journal, accounts] = await Promise.all([
    journalEntriesServerApi.getForPrint({ ...filters, from: fromDay, to: toDay }),
    accountsServerApi.list(),
  ]);

  return <JournalPrintScreen journal={journal} accounts={accounts} filters={filters} />;
}
