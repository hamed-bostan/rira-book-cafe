"use client";

import { Download } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { ACTIVITY_FILTER_PARAMS } from "@/src/lib/api/admin-activity-params";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { activityExports } from "./activity-api";

/**
 * Download what the log is filtered to, as CSV in the reader's language. The link
 * carries the page's filters (not its paging): the file holds every matching entry
 * the reader may see, not just the page on screen.
 */
export function ActivityExportLink() {
  const t = useTranslations("dashActivity");
  const locale = useLocale();
  const searchParams = useSearchParams();

  const params: Record<string, string> = { locale };
  for (const name of ACTIVITY_FILTER_PARAMS) {
    const value = searchParams.get(name);
    if (value) params[name] = value;
  }

  return (
    <Button asChild size="control-md" variant="secondary" className="shrink-0 px-3">
      <a href={activityExports.csvHref(params)} download>
        <Icon icon={Download} size="sm" />
        {t("exportCsv")}
      </a>
    </Button>
  );
}
