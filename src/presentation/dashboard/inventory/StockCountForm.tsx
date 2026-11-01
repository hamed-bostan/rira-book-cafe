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
import { AMOUNT, AMOUNT_INPUT, PAGE_CARD, ROW_TEXT, TABLE_HEAD, TABLE_TD, TABLE_TH } from "../pageStyles";

import { inventoryApi } from "./inventory-api";
import { UNIT_INSIDE, UNIT_SUFFIX } from "./stockFieldStyles";
import { formatStockQuantity } from "./stockFormat";

const NUMBER = /^\d+(\.\d{1,3})?$/;

/**
 * A physical count: type what's on the shelves for the items you counted (blank
 * ones are left alone). The difference from the system is shown as you type, and
 * on saving it's posted to Inventory variance.
 */
export function StockCountForm({
  items,
  today,
  costsVisible,
}: {
  items: StockItem[];
  today: string;
  costsVisible: boolean;
}) {
  const t = useTranslations("dashInventory");
  const tApiErrors = useTranslations("apiErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [date, setDate] = React.useState(today);
  const [note, setNote] = React.useState("");
  const [counted, setCounted] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const entered = items.filter((item) => NUMBER.test((counted[item.id] ?? "").trim()));
  const invalid = items.some(
    (item) => (counted[item.id] ?? "").trim() !== "" && !NUMBER.test((counted[item.id] ?? "").trim()),
  );
  const variance = entered.reduce(
    (sum, item) => sum + Math.round((Number(counted[item.id]) - item.onHand) * item.averageCost),
    0,
  );

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
        <DashboardField label={t("dateLabel")} hint={date ? formatCafeDayMedium(date, locale) : undefined}>
          <Input
            size="control-md"
            type="date"
            value={date}
            max={today}
            onChange={(event) => setDate(event.target.value)}
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

      <div className="overflow-hidden rounded-card-lg border border-border">
        {items.length === 0 ? (
          <DashboardEmptyState
            title={t("empty")}
            body=""
            action={
              <Button asChild size="control-md" className="px-4">
                <Link href="/dashboard/pricing/ingredients">{t("addItems")}</Link>
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className={cn(ROW_TEXT, "w-full min-w-xl table-fixed")}>
              <thead className={TABLE_HEAD}>
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
              <tbody className="divide-y divide-border">
                {items.map((item) => {
                  const raw = (counted[item.id] ?? "").trim();
                  const difference = NUMBER.test(raw) ? Number(raw) - item.onHand : null;
                  const unit = t(`unit.${item.unit}`);
                  return (
                    <tr key={item.id}>
                      <td className={cn(TABLE_TD, "py-2 align-middle font-medium text-foreground")} dir="auto">
                        {item.name}
                      </td>
                      <td className={cn(TABLE_TD, AMOUNT, "py-2 align-middle")}>
                        {formatStockQuantity(item.onHand, locale)} {unit}
                      </td>
                      <td className={cn(TABLE_TD, "py-2 align-middle")}>
                        <div className="relative">
                          <Input
                            size="control-md"
                            value={counted[item.id] ?? ""}
                            onChange={(event) =>
                              setCounted((current) => ({ ...current, [item.id]: event.target.value }))
                            }
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
                      <td
                        className={cn(
                          TABLE_TD,
                          AMOUNT,
                          "py-2 align-middle font-semibold",
                          difference === null || Math.abs(difference) < 0.0005
                            ? "text-muted-foreground"
                            : difference < 0
                              ? "text-error-foreground"
                              : "text-success-foreground",
                        )}
                      >
                        {difference === null
                          ? ""
                          : `${difference > 0 ? "+" : ""}${formatStockQuantity(difference, locale)} ${unit}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
