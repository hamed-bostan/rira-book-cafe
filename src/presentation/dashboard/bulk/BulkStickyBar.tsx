"use client";

import { useFormatter, useTranslations } from "next-intl";

import { Button } from "@/src/presentation/design-system/components/Button/Button";

import { useBulkSelection } from "./BulkSelectionProvider";

type BulkStickyBarProps = {
  /**
   * The actions for the selection — plain nodes, not a render prop, for the same
   * reason as `BulkActionBar`: the list renders this from a Server Component.
   */
  actions: React.ReactNode;
};

/**
 * The selection's bar for a long list: once rows are ticked it rests at the
 * bottom of the screen — above the phone's tab bar — while the list scrolls under
 * it, so the count, the actions and "Clear selection" stay in reach however far
 * down the ticked rows are. Nothing at all while nothing is selected.
 *
 * Rendered after the list, so it settles under the last row once that scrolls
 * into view (sticky, not fixed). `BulkActionBar` is the in-place variant for
 * tables whose toolbar it can stand in for.
 */
export function BulkStickyBar({ actions }: BulkStickyBarProps) {
  const t = useTranslations("dashBulk");
  const format = useFormatter();
  const { selected, clear } = useBulkSelection();

  if (selected.length === 0) return null;

  return (
    <div
      role="region"
      aria-label={t("label")}
      className="sticky bottom-[calc(var(--dashboard-bottom-nav-height,0px)+0.75rem)] z-20 mx-2 mb-2 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card-lg border border-border bg-background px-4 py-3 shadow-sheet print:hidden"
    >
      <span
        aria-live="polite"
        className="text-body-default font-semibold whitespace-nowrap text-foreground sm:text-body-small"
      >
        {t("selected", { count: format.number(selected.length) })}
      </span>
      <div className="flex flex-wrap gap-2">{actions}</div>
      <Button
        variant="link"
        size="control-md"
        onClick={clear}
        className="ms-auto px-2 font-medium text-muted-foreground hover:text-foreground hover:no-underline"
      >
        {t("clear")}
      </Button>
    </div>
  );
}
