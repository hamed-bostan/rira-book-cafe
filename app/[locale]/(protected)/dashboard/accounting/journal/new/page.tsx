import { getTranslations } from "next-intl/server";

import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { requirePermission } from "@/src/lib/require-permission";
import { accountsServerApi } from "@/src/presentation/dashboard/accounting/accounting-server-api";
import { ManualEntryForm } from "@/src/presentation/dashboard/accounting/ManualEntryForm";

export const dynamic = "force-dynamic";

export default async function NewJournalEntryPage() {
  await requirePermission("accounting.write");
  const [t, accounts] = await Promise.all([getTranslations("dashAccounting"), accountsServerApi.list()]);

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="dashboard-page-title">{t("form.title")}</h1>
        <p className="text-body-small text-muted-foreground">{t("form.subtitle")}</p>
      </div>
      <ManualEntryForm accounts={accounts} today={cafeDayOf(new Date())} />
    </div>
  );
}
