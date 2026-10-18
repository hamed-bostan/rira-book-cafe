import { CreditCard, TrendingUp, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ReportDirectoryCard, type ReportDirectoryItem } from "./ReportDirectoryCard";

/** The reports directory: one card per report. */
export async function ReportsScreen() {
  const t = await getTranslations("dashReports");

  const items: ReportDirectoryItem[] = [
    {
      id: "sales",
      title: t("sales.title"),
      description: t("sales.subtitle"),
      href: "/dashboard/reports/sales",
      icon: TrendingUp,
      tone: "green",
    },
    {
      id: "payments",
      title: t("payments.title"),
      description: t("payments.subtitle"),
      href: "/dashboard/reports/payments",
      icon: CreditCard,
      tone: "blue",
    },
    {
      id: "guests",
      title: t("guests.title"),
      description: t("guests.subtitle"),
      href: "/dashboard/reports/guests",
      icon: Users,
      tone: "violet",
    },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div>
        <h1 className="dashboard-page-title">{t("heading")}</h1>
        <p className="mt-1 text-body-small text-muted-foreground">{t("summary")}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {items.map((item, index) => (
          <ReportDirectoryCard
            key={item.id}
            item={item}
            openAria={t("openReport", { title: item.title })}
            fullWidth={index === items.length - 1 && items.length % 2 === 1}
          />
        ))}
      </div>
    </div>
  );
}
