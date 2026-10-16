import { getTranslations } from "next-intl/server";

/**
 * Dashboard overview. A placeholder until the first features (menu, orders) land —
 * then it reads its numbers over the BFF via a server-side service and hands them
 * to a presentational screen, like every other dashboard page.
 */
export default async function DashboardPage() {
  const t = await getTranslations("dashboard");

  return (
    <section className="flex flex-col gap-2">
      <h1 className="dashboard-page-title">{t("overviewTitle")}</h1>
      <p className="text-body-small text-muted-foreground">{t("overviewBody")}</p>
    </section>
  );
}
