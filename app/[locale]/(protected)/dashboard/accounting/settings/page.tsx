import { getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { requirePermission, sessionHas } from "@/src/lib/require-permission";
import { accountsServerApi } from "@/src/presentation/dashboard/accounting/accounting-server-api";
import { AccountingHeader } from "@/src/presentation/dashboard/accounting/AccountingHeader";
import { AccountingSettingsForm } from "@/src/presentation/dashboard/accounting/AccountingSettingsForm";
import { YearClosePanel } from "@/src/presentation/dashboard/accounting/YearClosePanel";
import { fiscalYearsServerApi } from "@/src/presentation/dashboard/inventory/inventory-server-api";

export const dynamic = "force-dynamic";

export default async function AccountingSettingsPage() {
  await requirePermission("accounting.view");
  const [t, settings, years, accounts, canWrite] = await Promise.all([
    getTranslations("dashAccounting"),
    accountsServerApi.getSettings(),
    fiscalYearsServerApi.list(),
    accountsServerApi.list(),
    auth().then((session) => sessionHas(session, "accounting.write")),
  ]);
  const today = cafeDayOf(new Date());

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <AccountingHeader
        active="settings"
        intro={t("settings.subtitle")}
        writer={canWrite ? { accounts, today } : null}
      />
      <AccountingSettingsForm settings={settings} today={today} canWrite={canWrite} />
      <YearClosePanel years={years} canWrite={canWrite} />
    </div>
  );
}
