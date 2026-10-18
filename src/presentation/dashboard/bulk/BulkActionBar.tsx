"use client";

import { X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { useBulkSelection } from "./BulkSelectionProvider";

type BulkActionBarProps = {
  /**
   * The actions this list offers — plain children, *not* a render prop.
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
  children: React.ReactNode;
};

/**
 * The bar that appears once rows are selected, holding whatever actions the list
 * offers. Renders nothing when the selection is empty, so a table nobody is
 * selecting in looks exactly as it did before.
 *
 * Sits above the table in the flow rather than floating over the bottom of the
 * viewport: these tables already scroll horizontally inside their own frame, and a
 * fixed bar is one more thing covering rows on a short screen. It keeps the count
 * and the escape hatch — an admin who selected the wrong twenty needs "clear" to be
 * as easy as the action.
 */
export function BulkActionBar({ children }: BulkActionBarProps) {
  const t = useTranslations("dashBulk");
  const format = useFormatter();
  const { selected, total, clear } = useBulkSelection();

  if (selected.length === 0) return null;

  /**
   * Counts are zero-padded to three digits — `001`, `012`, `156`.
   *
   * Padding is done by `Intl`, not by `padStart`, and that isn't fussiness: this
   * bar renders under `fa` too, where the digits are Persian and a Latin `"0"`
   * glued on the front would be a different character set in the same number.
   * `minimumIntegerDigits` pads in whatever numbering system the locale uses.
   */
  const padded = (value: number): string => format.number(value, { minimumIntegerDigits: 3 });

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-card-lg border border-primary bg-accent px-4 py-3">
      <span className="text-body-small-emphasis text-foreground">
        {t("selected", { count: padded(selected.length) })}
      </span>
      <div className="ms-auto flex flex-wrap items-center gap-2">
        {/* How much of the page is selected, which the count alone doesn't say:
            "003" beside a table of ten reads very differently from "003" beside a
            table of three, and the second is the case where "select all" has
            already done everything it can. */}
        <span className="text-body-small-strong text-muted-foreground">
          {t("selectedOf", { selected: padded(selected.length), total: padded(total) })}
        </span>
        {children}
        <Button variant="ghost" size="sm" onClick={clear}>
          <Icon icon={X} size="sm" className="me-1.5" />
          {t("clear")}
        </Button>
      </div>
    </div>
  );
}
