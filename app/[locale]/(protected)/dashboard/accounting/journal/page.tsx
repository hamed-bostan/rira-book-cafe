import { auth } from "@/auth";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { buildJournalParams, parseJournalFilters } from "@/src/lib/api/accounting-params";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { requirePermission, sessionHas } from "@/src/lib/require-permission";
import {
  accountsServerApi,
  journalEntriesServerApi,
} from "@/src/presentation/dashboard/accounting/accounting-server-api";
import { JournalScreen } from "@/src/presentation/dashboard/accounting/JournalScreen";
import { withRememberedPageSize } from "@/src/presentation/dashboard/list/withRememberedPageSize";

export const dynamic = "force-dynamic";

type JournalPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function JournalPage({ searchParams }: JournalPageProps) {
  await requirePermission("accounting.view");
  const params = await withRememberedPageSize(toSearchParams(await searchParams));
  // Newest first across the whole book; "Posted by" narrows it. A link from
  // elsewhere may still carry a span or an account, which the API honours.
  const filters = parseJournalFilters(params);
  const query = Object.fromEntries(buildJournalParams(filters));
  for (const key of ["page", "pageSize"]) {
    const value = params.get(key);
    if (value) query[key] = value;
  }

  const [page, accounts, canWrite] = await Promise.all([
    journalEntriesServerApi.list(query),
    accountsServerApi.list(),
    auth().then((session) => sessionHas(session, "accounting.write")),
  ]);

  return (
    <JournalScreen
      page={page}
      accounts={accounts}
      filtered={filters.source !== undefined}
      canWrite={canWrite}
      today={cafeDayOf(new Date())}
    />
  );
}
