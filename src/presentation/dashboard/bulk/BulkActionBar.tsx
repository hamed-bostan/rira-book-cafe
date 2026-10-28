"use client";

import { useFormatter, useTranslations } from "next-intl";

import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { DataTableToolbar } from "@/src/presentation/design-system/components/DataTable/DataTable";

import { useBulkSelection } from "./BulkSelectionProvider";

type BulkActionBarProps = {
  /**
   * The actions this list offers — plain nodes, *not* a render prop.
   *
   * A render prop would be the natural shape here, since every action needs the
   * selected ids and a way to clear them. It can't be: these bars are rendered from
   * Server Components, and a function can't cross that boundary — React has no way
   * to serialize one, and says so at runtime rather than at build time.
   *
   * So the ids travel through context instead of through props. Each action is a
   * client component already (it has to be, to call the API), so reaching for
   * `useBulkSelection()` costs it one line and keeps this boundary crossable.
   */
  actions: React.ReactNode;
  /** The table's toolbar (search, filters, sort), shown while nothing is selected. */
  children: React.ReactNode;
};

/**
 * The strip along a table's top edge, under its tabs: the toolbar while nothing is
 * selected, the selection's actions once rows are. The bar takes the toolbar's
 * place rather than stacking above the table, so selecting doesn't push the rows
 * down — and filtering mid-selection, which would drop the selection, isn't on offer.
 *
 * It keeps the count and the escape hatch — an admin who selected the wrong twenty
 * needs "Clear selection" to be as easy as the action.
 */
export function BulkActionBar({ actions, children }: BulkActionBarProps) {
  const t = useTranslations("dashBulk");
  const format = useFormatter();
  const { selected, clear } = useBulkSelection();

  if (selected.length === 0) return <DataTableToolbar>{children}</DataTableToolbar>;

  return (
    <DataTableToolbar
      role="region"
      aria-label={t("label")}
      className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-accent"
    >
      <span className="text-body-default font-semibold whitespace-nowrap text-accent-foreground sm:text-body-small">
        {t("selected", { count: format.number(selected.length) })}
      </span>
      <div className="flex flex-wrap gap-2">{actions}</div>
      <Button
        variant="link"
        size="control-md"
        onClick={clear}
        className="ms-auto px-2 font-medium text-accent-foreground hover:text-foreground hover:no-underline sm:min-h-10"
      >
        {t("clear")}
      </Button>
    </DataTableToolbar>
  );
}
