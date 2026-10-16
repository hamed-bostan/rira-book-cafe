import { auth } from "@/auth";
import { buildJournalParams, parseDaySpan, parseJournalFilters } from "@/src/lib/api/accounting-params";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { requirePermission, sessionHas } from "@/src/lib/require-permission";
import { journalEntriesServerApi } from "@/src/presentation/dashboard/accounting/accounting-server-api";
import { JournalScreen } from "@/src/presentation/dashboard/accounting/JournalScreen";

export const dynamic = "force-dynamic";

type JournalPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function JournalPage({ searchParams }: JournalPageProps) {
  await requirePermission("accounting.view");
  const params = toSearchParams(await searchParams);
  const { fromDay, toDay } = parseDaySpan(params);
  const filters = { ...parseJournalFilters(params), fromDay, toDay };

  // The other filters ride along when the period changes; the period itself is the picker's.
  const keep = Object.fromEntries(buildJournalParams({ ...filters, fromDay: undefined, toDay: undefined }));
  const query: Record<string, string> = { ...Object.fromEntries(buildJournalParams(filters)) };
  for (const key of ["page", "pageSize"]) {
    const value = params.get(key);
    if (value) query[key] = value;
  }

  const [page, canWrite] = await Promise.all([
    journalEntriesServerApi.list(query),
    auth().then((session) => sessionHas(session, "accounting.write")),
  ]);

  return <JournalScreen page={page} fromDay={fromDay} toDay={toDay} keep={keep} canWrite={canWrite} />;
}
