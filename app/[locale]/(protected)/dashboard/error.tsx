"use client";

import { useTranslations } from "next-intl";

import { RouteErrorState, type RouteErrorProps } from "@/src/presentation/components/RouteErrorState";

/**
 * Dashboard error boundary. A failed server fetch (e.g. the categories REST call)
 * renders here, inside the shell, with a retry that re-fetches and re-runs the
 * segment — the App Router replacement for a hand-rolled "try again" on a client
 * fetch.
 */
export default function DashboardError(props: RouteErrorProps) {
  const t = useTranslations("dashboard");

  return (
    <div className="rounded-card-lg border border-dashed border-border">
      <RouteErrorState {...props} size="section" title={t("errorTitle")} description={t("errorBody")} homeHref="/dashboard" />
    </div>
  );
}
