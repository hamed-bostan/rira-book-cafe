"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import type { StockItem } from "@/src/domain/entities/Inventory";
import { Link, useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { Button, FormMessage, Input, useToast } from "@/src/presentation/design-system";

import { inventoryApi } from "./inventory-api";

const NUMBER = /^\d+(\.\d{1,3})?$/;

/**
 * A physical count: type what's on the shelves for the items you counted (blank
 * ones are left alone). The difference from the system is shown as you type, and
 * on saving it's posted to Inventory variance.
 */
export function StockCountForm({ items, today, costsVisible }: { items: StockItem[]; today: string; costsVisible: boolean }) {
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
  const invalid = items.some((item) => (counted[item.id] ?? "").trim() !== "" && !NUMBER.test((counted[item.id] ?? "").trim()));
  const variance = entered.reduce((sum, item) => sum + Math.round((Number(counted[item.id]) - item.onHand) * item.averageCost), 0);

  function submit(): void {
    setError(null);
    startTransition(async () => {
      try {
        await inventoryApi.count({ date, note, lines: entered.map((item) => ({ ingredientId: item.id, counted: counted[item.id].trim() })) });
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
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (entered.length > 0 && !invalid) submit();
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[12rem_1fr]">
        <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
          {t("dateLabel")}
          <Input type="date" value={date} max={today} onChange={(event) => setDate(event.target.value)} dir="ltr" />
          <span className="text-body-caption font-normal text-muted-foreground">{date ? formatCafeDayMedium(date, locale) : ""}</span>
        </label>
        <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
          {t("count.noteLabel")}
          <Input value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} dir="auto" placeholder={t("count.notePlaceholder")} />
        </label>
      </div>

      <section className="min-w-0 overflow-x-auto rounded-card-lg border border-border bg-background">
        <table className="w-full min-w-[36rem] text-body-small">
          <thead className="bg-surface text-body-caption text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 text-start font-medium">{t("col.item")}</th>
              <th scope="col" className="px-4 py-3 text-end font-medium">{t("count.expected")}</th>
              <th scope="col" className="px-4 py-3 text-start font-medium">{t("count.counted")}</th>
              <th scope="col" className="px-4 py-3 text-end font-medium">{t("count.difference")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item) => {
              const raw = (counted[item.id] ?? "").trim();
              const difference = NUMBER.test(raw) ? Number(raw) - item.onHand : null;
              const unit = t(`unit.${item.unit}`);
              return (
                <tr key={item.id}>
                  <td className="px-4 py-2.5 text-foreground" dir="auto">
                    {item.name}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-end text-muted-foreground">
                    {formatNumber(item.onHand, locale, 3)} {unit}
                  </td>
                  <td className="px-4 py-2.5">
                    <Input
                      value={counted[item.id] ?? ""}
                      onChange={(event) => setCounted((current) => ({ ...current, [item.id]: event.target.value }))}
                      inputMode="decimal"
                      aria-label={t("count.countedFor", { name: item.name })}
                      className="h-9 w-28"
                      dir="ltr"
                    />
                  </td>
                  <td
                    className={cn(
                      "whitespace-nowrap px-4 py-2.5 text-end",
                      difference === null || Math.abs(difference) < 0.0005 ? "text-muted-foreground" : difference < 0 ? "text-error-foreground" : "text-success-foreground",
                    )}
                  >
                    {difference === null ? "" : `${difference > 0 ? "+" : ""}${formatNumber(difference, locale, 3)} ${unit}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {costsVisible && entered.length > 0 ? (
        <p className={variance < 0 ? "text-body-small-emphasis text-error-foreground" : "text-body-small-emphasis text-foreground"}>
          {t("count.varianceTotal", { amount: formatMoney(variance, locale) })}
        </p>
      ) : null}
      {invalid ? <FormMessage>{t("count.invalid")}</FormMessage> : null}
      {error ? <FormMessage size="md">{error}</FormMessage> : null}

      <div className="flex gap-3">
        <Button type="submit" loading={pending} disabled={entered.length === 0 || invalid}>
          {t("count.save", { count: entered.length })}
        </Button>
        <Button asChild variant="outline" type="button">
          <Link href="/dashboard/inventory">{t("cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
