import { CircleCheck, Lock } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { CashClose, CashCloseStatus, CashDayFigures } from "@/src/domain/entities/CashClose";
import type { Page } from "@/src/domain/entities/Pagination";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";

import { CashCloseForm } from "./CashCloseForm";
import { CashCloseHistory } from "./CashCloseHistory";
import { CashDayPanel } from "./CashDayPanel";
import { CashDayPicker } from "./CashDayPicker";
import { UnclosedCashAlert } from "./UnclosedCashAlert";

type CashRegisterScreenProps = {
  /** The day being counted. */
  day: string;
  status: CashCloseStatus;
  closes: Page<CashClose>;
  /** The day's expected cash — present only for managers (`accounting.view`). */
  figures: CashDayFigures | null;
  canViewBooks: boolean;
};

/**
 * The cash register: which days still need closing, the count for the chosen day
 * (with the expected figures for managers), and every close so far.
 */
export async function CashRegisterScreen({ day, status, closes, figures, canViewBooks }: CashRegisterScreenProps) {
  const t = await getTranslations("dashCash");
  const locale = await getLocale();
  const closedDay = closes.items.find((close) => close.day === day);
  // Closes are made in day order: a day on or before the last close can't be closed any more.
  const locked = status.lastClosedDay !== undefined && day <= status.lastClosedDay;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div>
        <h1 className="dashboard-page-title">{t("heading")}</h1>
        <p className="mt-1 text-body-small text-muted-foreground">{t("subtitle")}</p>
      </div>

      <UnclosedCashAlert status={status} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <CashDayPicker day={day} today={status.today} />
        <p className="text-body-small text-muted-foreground">
          {status.lastClosedDay ? t("lastClosed", { date: formatCafeDayMedium(status.lastClosedDay, locale) }) : t("neverClosed")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {locked ? (
          <section className="flex items-start gap-3 rounded-card-lg border border-border bg-surface p-4 text-body-small text-foreground md:p-6">
            {closedDay ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-success-foreground" aria-hidden /> : <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />}
            <p>{closedDay ? t("dayClosed", { date: formatCafeDayMedium(day, locale), by: closedDay.closedByName }) : t("dayLocked", { date: formatCafeDayMedium(day, locale) })}</p>
          </section>
        ) : (
          <CashCloseForm key={`${day}-${figures?.expected ?? "blind"}`} day={day} expected={figures?.expected} />
        )}
        {figures && !locked ? <CashDayPanel figures={figures} /> : null}
      </div>

      <CashCloseHistory page={closes} canViewBooks={canViewBooks} />
    </div>
  );
}
