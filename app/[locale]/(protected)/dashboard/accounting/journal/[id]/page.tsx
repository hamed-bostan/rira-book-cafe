import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { requirePermission, sessionHas } from "@/src/lib/require-permission";
import { accountsServerApi, journalEntriesServerApi } from "@/src/presentation/dashboard/accounting/accounting-server-api";
import { JournalEntryScreen } from "@/src/presentation/dashboard/accounting/JournalEntryScreen";

export const dynamic = "force-dynamic";

type JournalEntryPageProps = { params: Promise<{ id: string }> };

export default async function JournalEntryPage({ params }: JournalEntryPageProps) {
  await requirePermission("accounting.view");
  const { id } = await params;
  const [entry, accounts, canWrite] = await Promise.all([
    journalEntriesServerApi.getById(id),
    accountsServerApi.list(),
    auth().then((session) => sessionHas(session, "accounting.write")),
  ]);
  if (!entry) notFound();

  return <JournalEntryScreen entry={entry} accounts={accounts} canWrite={canWrite} today={cafeDayOf(new Date())} />;
}
