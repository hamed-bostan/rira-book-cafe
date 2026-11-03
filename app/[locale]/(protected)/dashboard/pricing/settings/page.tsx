import { getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { requirePermission, sessionHas } from "@/src/lib/require-permission";
import { pricingServerApi } from "@/src/presentation/dashboard/pricing/pricing-server-api";
import { PricingSettingsForm } from "@/src/presentation/dashboard/pricing/PricingSettingsForm";
import { PricingTabs } from "@/src/presentation/dashboard/pricing/PricingTabs";
import { SuitePriceForm } from "@/src/presentation/dashboard/pricing/SuitePriceForm";
import { suitePricesServerApi } from "@/src/presentation/dashboard/suite-bookings/suite-price-server-api";

export const dynamic = "force-dynamic";

export default async function PricingSettingsPage() {
  await requirePermission("accounting.view");
  const [t, report, suite, canWrite] = await Promise.all([
    getTranslations("dashPricing"),
    pricingServerApi.getReport(),
    suitePricesServerApi.getDefault(),
    auth().then((session) => sessionHas(session, "accounting.write")),
  ]);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PricingTabs active="settings" title={t("settings.heading")} subtitle={t("settings.subtitle")} />
      <PricingSettingsForm settings={report.settings} canWrite={canWrite} />
      <SuitePriceForm settings={suite} canWrite={canWrite} />
    </div>
  );
}
