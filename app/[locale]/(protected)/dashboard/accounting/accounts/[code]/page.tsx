import { notFound } from "next/navigation";

import { parseDaySpan } from "@/src/lib/api/accounting-params";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { requirePermission } from "@/src/lib/require-permission";
import { accountsServerApi } from "@/src/presentation/dashboard/accounting/accounting-server-api";
import { AccountLedgerScreen } from "@/src/presentation/dashboard/accounting/AccountLedgerScreen";

export const dynamic = "force-dynamic";

type AccountLedgerPageProps = {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AccountLedgerPage({ params, searchParams }: AccountLedgerPageProps) {
  await requirePermission("accounting.view");
  const [{ code }, query] = await Promise.all([params, searchParams]);
  const { fromDay, toDay } = parseDaySpan(toSearchParams(query));

  const ledger = await accountsServerApi.getLedger(code, { from: fromDay, to: toDay });
  if (!ledger) notFound();

  return <AccountLedgerScreen ledger={ledger} />;
}
