import { auth } from "@/auth";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { INCOME_STATUSES, type IncomeStatus } from "@/src/domain/entities/Income";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { requirePermission, sessionHas } from "@/src/lib/require-permission";
import { accountsServerApi } from "@/src/presentation/dashboard/accounting/accounting-server-api";
import { incomesServerApi } from "@/src/presentation/dashboard/income/income-server-api";
import { IncomeScreen } from "@/src/presentation/dashboard/income/IncomeScreen";
import { withRememberedPageSize } from "@/src/presentation/dashboard/list/withRememberedPageSize";

export const dynamic = "force-dynamic";

type IncomePageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function IncomePage({ searchParams }: IncomePageProps) {
  await requirePermission("accounting.view");
  const params = await withRememberedPageSize(toSearchParams(await searchParams));
  const statusParam = params.get("status");
  const status = (INCOME_STATUSES as readonly string[]).includes(statusParam ?? "")
    ? (statusParam as IncomeStatus)
    : undefined;
  const query = params.get("q")?.trim() || undefined;

  const [page, accounts, settings, canWrite] = await Promise.all([
    incomesServerApi.list(Object.fromEntries(params)),
    accountsServerApi.list(),
    accountsServerApi.getSettings(),
    auth().then((session) => sessionHas(session, "accounting.write")),
  ]);

  return (
    <IncomeScreen
      page={page}
      accounts={accounts}
      status={status}
      query={query}
      today={cafeDayOf(new Date())}
      vatRateBps={settings.vatRateBps}
      canWrite={canWrite}
    />
  );
}
