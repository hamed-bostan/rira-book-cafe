import { getTranslations } from "next-intl/server";

import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { requirePermission } from "@/src/lib/require-permission";
import { accountsServerApi } from "@/src/presentation/dashboard/accounting/accounting-server-api";
import { ManualEntryForm } from "@/src/presentation/dashboard/accounting/ManualEntryForm";
import { DashboardPageHeader } from "@/src/presentation/dashboard/DashboardPageHeader";
import { DashboardPageCrumb } from "@/src/presentation/dashboard/shell/DashboardPageCrumb";

export const dynamic = "force-dynamic";

export default async function NewJournalEntryPage() {
  await requirePermission("accounting.write");
  const [t, accounts] = await Promise.all([getTranslations("dashAccounting"), accountsServerApi.list()]);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardPageCrumb label={t("form.title")} />
      <DashboardPageHeader
        backHref="/dashboard/accounting/journal"
        backLabel={t("journal.heading")}
        title={t("form.title")}
        subtitle={t("form.subtitle")}
      />
      <ManualEntryForm accounts={accounts} today={cafeDayOf(new Date())} />
    </div>
  );
}
