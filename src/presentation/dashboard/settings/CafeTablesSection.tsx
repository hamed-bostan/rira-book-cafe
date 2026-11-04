import { getLocale, getTranslations } from "next-intl/server";

import { MAX_CAFE_TABLES, seatsAtTables, type CafeTable } from "@/src/domain/entities/CafeTable";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";

import { DashboardSection } from "../DashboardSection";
import { FIELD_HINT } from "../fieldStyles";
import { tableNameValues } from "../floor/tableName";

import { AddCafeTableButton } from "./AddCafeTableButton";
import { CafeTableRowActions } from "./CafeTableRowActions";

/**
 * The floor's tables, in floor order — the order every table picker lists them:
 * each with its seats and area, "Out of use" when it's off the pickers, and the
 * controls to move, edit, take out of use or delete it. Bookings and event holds
 * name tables by their label.
 */
export async function CafeTablesSection({ tables }: { tables: CafeTable[] }) {
  const t = await getTranslations("dashSettings.tables");
  const tFloor = await getTranslations("floorTables");
  const locale = await getLocale();

  const inUse = tables.filter((table) => table.isActive);
  const summary = t("summary", {
    count: inUse.length,
    tables: formatNumber(inUse.length, locale),
    seats: formatNumber(
      seatsAtTables(
        inUse,
        inUse.map((table) => table.label),
      ),
      locale,
    ),
  });

  return (
    <DashboardSection title={t("heading")} description={t("description")} aside={summary} flush>
      {tables.length === 0 ? (
        <p className={cn(FIELD_HINT, "px-5 pt-4")}>{t("empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border" aria-label={t("heading")}>
          {tables.map((table, index) => {
            const name = tFloor("tableName", tableNameValues(table.label, locale));
            return (
              <li
                key={table.id}
                aria-label={name}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-3 text-body-default sm:text-body-small"
              >
                <span aria-hidden className="w-5 shrink-0 text-end text-muted-foreground tabular-nums">
                  {formatNumber(index + 1, locale)}
                </span>
                <div className="flex min-w-0 flex-[1_1_10rem] flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      dir="auto"
                      className={cn("font-semibold", table.isActive ? "text-foreground" : "text-muted-foreground")}
                    >
                      {name}
                    </span>
                    {table.isActive ? null : (
                      <Badge variant="neutral" appearance="outline" size="compact" dot>
                        {t("outOfUse")}
                      </Badge>
                    )}
                  </div>
                  <span className="text-body-small text-muted-foreground sm:text-body-caption" dir="auto">
                    {[tFloor("seats", { seats: formatNumber(table.seats, locale) }), table.area]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
                <CafeTableRowActions
                  table={table}
                  name={name}
                  isFirst={index === 0}
                  isLast={index === tables.length - 1}
                />
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-col gap-2 p-5">
        <AddCafeTableButton disabled={tables.length >= MAX_CAFE_TABLES} />
      </div>
    </DashboardSection>
  );
}
