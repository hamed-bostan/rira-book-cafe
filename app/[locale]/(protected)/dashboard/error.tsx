"use client";

import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button, Icon } from "@/src/presentation/design-system";

/**
 * Dashboard error boundary. A failed server fetch (e.g. the categories REST call)
 * renders here with a retry that re-runs the segment — the App Router replacement
 * for a hand-rolled "try again" on a client fetch.
 */
export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("dashboard");

  return (
    <div className="rounded-card-lg border border-dashed border-border px-6 py-16 text-center">
      <p className="text-body-strong text-foreground">{t("errorTitle")}</p>
      <p className="mt-1 text-body-small text-muted-foreground">{t("errorBody")}</p>
      <Button variant="outline" size="sm" className="mt-4" onClick={reset}>
        <Icon icon={RotateCcw} size="sm" className="me-1.5" />
        {t("tryAgain")}
      </Button>
    </div>
  );
}
