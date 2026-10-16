import { getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { requirePermission, sessionHas } from "@/src/lib/require-permission";
import { accountsServerApi } from "@/src/presentation/dashboard/accounting/accounting-server-api";
import { AccountingSettingsForm } from "@/src/presentation/dashboard/accounting/AccountingSettingsForm";
import { AccountingTabs } from "@/src/presentation/dashboard/accounting/AccountingTabs";

export const dynamic = "force-dynamic";

export default async function AccountingSettingsPage() {
  await requirePermission("accounting.view");
  const [t, settings, canWrite] = await Promise.all([
    getTranslations("dashAccounting"),
    accountsServerApi.getSettings(),
    auth().then((session) => sessionHas(session, "accounting.write")),
  ]);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <AccountingTabs active="settings" title={t("settings.heading")} subtitle={t("settings.subtitle")} />
      <AccountingSettingsForm settings={settings} today={cafeDayOf(new Date())} canWrite={canWrite} />
    </div>
  );
}
