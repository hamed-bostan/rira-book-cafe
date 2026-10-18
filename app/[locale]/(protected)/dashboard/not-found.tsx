import { SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/src/i18n/navigation";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { EmptyState } from "@/src/presentation/design-system/components/EmptyState/EmptyState";

/**
 * 404 for dashboard records that don't exist (an order, expense or journal entry
 * id that was mistyped or deleted). Renders inside the shell, so the sidebar
 * stays and the way back is one click.
 */
export default async function DashboardNotFound() {
  const t = await getTranslations("notFound");
  const tDashboard = await getTranslations("dashboard");

  return (
    <div className="rounded-card-lg border border-dashed border-border">
      <EmptyState
        size="page"
        icon={SearchX}
        title={t("title")}
        description={t("body")}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">{tDashboard("bottomNav.dashboard")}</Link>
          </Button>
        }
      />
    </div>
  );
}
