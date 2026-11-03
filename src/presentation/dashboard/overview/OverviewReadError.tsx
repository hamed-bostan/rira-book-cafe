import { getTranslations } from "next-intl/server";

import { DashboardEmptyState } from "@/src/presentation/dashboard/DashboardEmptyState";

import { RetryReadButton } from "./RetryReadButton";

/**
 * What an overview panel shows in place of its rows when its read failed: that
 * this part didn't load, that the rest of the page is current, and a retry.
 */
export async function OverviewReadError({ className }: { className?: string }) {
  const t = await getTranslations("dashOverview");

  return (
    <DashboardEmptyState
      title={t("readErrorTitle")}
      body={t("readErrorBody")}
      action={<RetryReadButton />}
      className={className}
    />
  );
}
