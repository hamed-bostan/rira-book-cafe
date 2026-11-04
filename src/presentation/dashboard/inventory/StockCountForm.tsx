"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import type { StockItem } from "@/src/domain/entities/Inventory";
import { Link, useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatMoney } from "@/src/lib/formatMoney";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardEmptyState } from "../DashboardEmptyState";
import { DashboardField } from "../DashboardField";
import { FIELD_INPUT } from "../fieldStyles";
import { FormAlert } from "../FormAlert";
import { AMOUNT_INPUT, PAGE_CARD, ROW_TEXT, TABLE_HEAD, TABLE_TH } from "../pageStyles";
import { STACKED_TABLE } from "../stackedTableStyles";

import { inventoryApi } from "./inventory-api";
import { UNIT_INSIDE, UNIT_SUFFIX } from "./stockFieldStyles";
import { formatStockQuantity } from "./stockFormat";

const NUMBER = /^\d+(\.\d{1,3})?$/;

/** Four columns: stacked rows under a tablet's card, the table from there up. */
const S = STACKED_TABLE.compact;

/**
 * A physical count: type what's on the shelves for the items you counted (blank
 * ones are left alone). The difference from the system is shown as you type, and
 * on saving it's posted to Inventory variance. A table from a tablet's width; on a
 * phone each item leads its row, with what's expected and the difference beside
 * each other and the count under them.
 *
 * Dated in the past, each item is compared with what it had on hand at the end of
 * that day (`expected`, read by the page for the date in its query string), and the
 * difference is applied to today's stock — see `CountStock`.
 */
export function StockCountForm({
  items,
  today,
  date: countDate,
  expected,
  costsVisible,
}: {
  items: StockItem[];
  today: string;
  /** The count's day, from the query string. */
  date: string;
  /** On hand at the end of a past `date`, by item; absent for today. */
  expected?: Readonly<Record<string, number>>;
  costsVisible: boolean;
}) {
  const t = useTranslations("dashInventory");
  const tApiErrors = useTranslations("apiErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [date, setDate] = React.useState(countDate);
  const [note, setNote] = React.useState("");
  const [counted, setCounted] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const expectedOf = (item: StockItem): number => expected?.[item.id] ?? item.onHand;
  const entered = items.filter((item) => NUMBER.test((counted[item.id] ?? "").trim()));
  const invalid = items.some(
    (item) => (counted[item.id] ?? "").trim() !== "" && !NUMBER.test((counted[item.id] ?? "").trim()),
  );
  const variance = entered.reduce(
    (sum, item) => sum + Math.round((Number(counted[item.id]) - expectedOf(item)) * item.averageCost),
    0,
  );

  /** A new day re-reads what was expected on it; what's typed so far stays. */
  function changeDate(next: string): void {
    setDate(next);
    if (/^\d{4}-\d{2}-\d{2}$/.test(next) && next <= today) {
      router.replace(next === today ? "/dashboard/inventory/count" : `/dashboard/inventory/count?date=${next}`, {
        scroll: false,
      });
    }
  }

  function submit(): void {
    setError(null);
    startTransition(async () => {
      try {
        await inventoryApi.count({
          date,
          note,
          lines: entered.map((item) => ({ ingredientId: item.id, counted: counted[item.id].trim() })),
        });
        toast({ tone: "success", title: t("count.saved") });
        router.push("/dashboard/inventory");
        router.refresh();
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, t("count.error")));
      }
    });
  }

  return (
    <form
      className={cn(PAGE_CARD, "flex flex-col gap-5 p-5")}
      onSubmit={(event) => {
        event.preventDefault();
        if (entered.length > 0 && !invalid) submit();
      }}
    >
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[12rem_minmax(0,1fr)]">
        <DashboardField
          label={t("dateLabel")}
          hint={
            date
              ? date < today
                ? t("count.backdatedHint", { date: formatCafeDayMedium(date, locale) })
                : formatCafeDayMedium(date, locale)
              : undefined
          }
        >
          <Input
            size="control-md"
            type="date"
            value={date}
            max={today}
            onChange={(event) => changeDate(event.target.value)}
            dir="ltr"
            inputClassName={FIELD_INPUT}
          />
        </DashboardField>
        <DashboardField label={t("count.noteLabel")}>
          <Input
            size="control-md"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={200}
            dir="auto"
            placeholder={t("count.notePlaceholder")}
            inputClassName={FIELD_INPUT}
          />
        </DashboardField>
      </div>

      <div className={cn(S.frame, "overflow-hidden rounded-card-lg border border-border")}>
        {items.length === 0 ? (
          <DashboardEmptyState
            title={t("empty")}
            body=""
            action={
              <Button asChild size="control-md" className="px-4">
                <Link href="/dashboard/inventory">{t("addItems")}</Link>
              </Button>
            }
          />
        ) : (
          <table className={cn(ROW_TEXT, S.table)}>
            <thead className={cn(TABLE_HEAD, S.head)}>
              <tr>
                <th scope="col" className={TABLE_TH}>
                  {t("col.item")}
                </th>
                <th scope="col" className={cn(TABLE_TH, "w-36 text-end")}>
                  {t("count.expected")}
                </th>
                <th scope="col" className={cn(TABLE_TH, "w-40 text-end")}>
                  {t("count.counted")}
                </th>
                <th scope="col" className={cn(TABLE_TH, "w-40 text-end")}>
                  {t("count.difference")}
                </th>
              </tr>
            </thead>
            <tbody className={cn(S.body, "divide-y divide-border")}>
              {items.map((item) => {
                const raw = (counted[item.id] ?? "").trim();
                const difference = NUMBER.test(raw) ? Number(raw) - expectedOf(item) : null;
                const unit = t(`unit.${item.unit}`);
                return (
                  <tr key={item.id} className={S.row}>
                    <td className={cn(S.lead, "align-middle font-medium text-foreground @xl/sheet:py-2")} dir="auto">
                      {item.name}
                    </td>
                    <td className={cn(S.cell, S.amount, "align-middle @xl/sheet:py-2")}>
                      <span className={S.label}>{t("count.expected")}</span>
                      {formatStockQuantity(expectedOf(item), locale)} {unit}
                    </td>
                    {/* Stacked, the count gets a line of its own under the figures, as wide as the row. */}
                    <td className={cn(S.cell, "order-last basis-full align-middle @xl/sheet:py-2")}>
                      <span className={S.label}>{t("count.counted")}</span>
                      <div className="relative">
                        <Input
                          size="control-md"
                          value={counted[item.id] ?? ""}
                          onChange={(event) => setCounted((current) => ({ ...current, [item.id]: event.target.value }))}
                          inputMode="decimal"
                          aria-label={t("count.countedFor", { name: item.name })}
                          inputClassName={cn(FIELD_INPUT, AMOUNT_INPUT, UNIT_INSIDE, "sm:min-h-8 sm:py-1")}
                          dir="ltr"
                        />
                        <span aria-hidden className={UNIT_SUFFIX}>
                          {unit}
                        </span>
                      </div>
                    </td>
                    {/* Stacked, the difference shows once there's a count to compare. */}
                    <td
                      className={cn(
                        S.cell,
                        S.amount,
                        "align-middle font-semibold @xl/sheet:py-2",
                        difference === null && "hidden",
                        difference === null || Math.abs(difference) < 0.0005
                          ? "text-muted-foreground"
                          : difference < 0
                            ? "text-error-foreground"
                            : "text-success-foreground",
                      )}
                    >
                      <span className={S.label}>{t("count.difference")}</span>
                      {difference === null ? null : (
                        <span>
                          <span dir="ltr">
                            {difference > 0 ? "+" : ""}
                            {formatStockQuantity(difference, locale)}
                          </span>{" "}
                          {unit}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {costsVisible && entered.length > 0 ? (
        <p
          className={cn(
            ROW_TEXT,
            "font-semibold tabular-nums",
            variance < 0 ? "text-error-foreground" : "text-foreground",
          )}
        >
          {t("count.varianceTotal", { amount: formatMoney(variance, locale) })}
        </p>
      ) : null}
      {invalid ? <FormMessage>{t("count.invalid")}</FormMessage> : null}
      {error ? <FormAlert>{error}</FormAlert> : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          size="control-md"
          className="px-4"
          loading={pending}
          disabled={entered.length === 0 || invalid}
        >
          {t("count.save", { count: entered.length })}
        </Button>
        <Button asChild variant="secondary" size="control-md" className="px-3">
          <Link href="/dashboard/inventory">{t("cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
