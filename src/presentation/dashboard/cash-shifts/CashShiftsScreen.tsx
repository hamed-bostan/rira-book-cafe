import { Banknote, CreditCard, Globe, Wallet } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { formatCafeDayShort } from "@/src/lib/formatCafeDay";
import { formatMoney, moneyUnit } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { formatOrderTime } from "@/src/lib/formatOrderDate";
import { cn } from "@/src/lib/utils";
import { AutoRefresh } from "@/src/presentation/components/AutoRefresh";
import { MetricCard } from "@/src/presentation/dashboard/MetricCard";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";

import { CloseShiftForm, OpenShiftForm } from "./CashShiftForms";
import { shiftResult } from "./shiftResult";

import type { CashShiftOverview } from "./cash-shift-response-schema";
import type { ReactNode } from "react";

/** How often the open shift's figures are re-read while the page is open. */
const REFRESH_SECONDS = 60;

const PANEL = "flex min-w-0 flex-col rounded-card-lg border border-border bg-background p-5 shadow-xs";

type PanelHeadingProps = {
  id: string;
  title: string;
  /** Sits beside the title — the open shift's status. */
  badge?: ReactNode;
  description?: string;
};

function PanelHeading({ id, title, badge, description }: PanelHeadingProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id={id} className="text-body-strong text-foreground">
          {title}
        </h2>
        {badge}
      </div>
      {description ? (
        <p className="text-body-default text-pretty text-muted-foreground sm:text-body-small">{description}</p>
      ) : null}
    </div>
  );
}

/**
 * The till: the open shift with what the drawer should hold so far (and what went
 * to the bank and the gateway), the form that closes it by counting the drawer —
 * or, with none open, the form that opens the next — and past shifts with their
 * over or short. Presentational — the page fetches over the REST API; the open
 * shift's figures refresh while the page is open.
 */
export async function CashShiftsScreen({ overview }: { overview: CashShiftOverview }) {
  const t = await getTranslations("dashCashShifts");
  const locale = await getLocale();
  const { current, recent } = overview;
  const closed = recent.filter((shift) => shift.status === "closed");
  // Shift numbers run in sequence, so the next one follows the latest.
  const nextNumber = Math.max(0, ...recent.map((shift) => shift.number)) + 1;

  const when = (iso: string): string =>
    t("when", { day: formatCafeDayShort(cafeDayOf(new Date(iso)), locale), time: formatOrderTime(iso, locale) });
  const number = (value: number): string => formatNumber(value, locale);
  const unit = moneyUnit(locale);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="dashboard-page-title">{t("heading")}</h1>
        <p className="text-body-default text-pretty text-muted-foreground sm:text-body-small">{t("subtitle")}</p>
      </div>

      {current ? (
        <>
          <AutoRefresh intervalSeconds={REFRESH_SECONDS} />
          <section aria-labelledby="open-shift-heading" className={cn(PANEL, "gap-5")}>
            <PanelHeading
              id="open-shift-heading"
              title={t("openShift", { number: number(current.shift.number) })}
              badge={
                <Badge variant="success" appearance="outline" dot>
                  {t("openBadge")}
                </Badge>
              }
              description={t("openedBy", { name: current.shift.openedByName, date: when(current.shift.openedAt) })}
            />
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <MetricCard label={t("float")} icon={Wallet} value={number(current.shift.openingFloat)} unit={unit} />
              <MetricCard label={t("expected")} icon={Banknote} value={number(current.expectedCash)} unit={unit} />
              <MetricCard label={t("bank")} icon={CreditCard} value={number(current.movements.bank)} unit={unit} />
              <MetricCard label={t("online")} icon={Globe} value={number(current.movements.online)} unit={unit} />
            </div>
            <p className="text-body-small text-muted-foreground sm:text-body-caption">
              {t("paymentsCount", {
                count: current.movements.payments,
                formatted: number(current.movements.payments),
              })}
            </p>
          </section>

          <section aria-labelledby="close-shift-heading" className={cn(PANEL, "gap-4")}>
            <PanelHeading id="close-shift-heading" title={t("closeHeading")} description={t("closeDescription")} />
            <CloseShiftForm shiftId={current.shift.id} expectedCash={current.expectedCash} />
          </section>
        </>
      ) : (
        <section aria-labelledby="open-a-shift-heading" className={cn(PANEL, "gap-4")}>
          <PanelHeading id="open-a-shift-heading" title={t("openHeading")} description={t("openDescription")} />
          <OpenShiftForm nextNumber={nextNumber} />
        </section>
      )}

      <section aria-labelledby="past-shifts-heading" className={cn(PANEL, "gap-2")}>
        <PanelHeading id="past-shifts-heading" title={t("historyHeading")} />
        {closed.length === 0 ? (
          <p className="text-body-default text-muted-foreground sm:text-body-small">{t("historyEmpty")}</p>
        ) : (
          <ul>
            {closed.map((shift, index) => {
              const result = shiftResult(shift.difference ?? 0);
              return (
                <li
                  key={shift.id}
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3",
                    index > 0 && "border-t border-border",
                  )}
                >
                  <div className="flex min-w-0 flex-[1_1_15rem] flex-col gap-0.5">
                    <span className="text-body-default font-semibold text-foreground tabular-nums sm:text-body-small">
                      {t("historyTitle", {
                        number: number(shift.number),
                        when: shift.closedAt ? when(shift.closedAt) : "—",
                      })}
                    </span>
                    <span className="text-body-small text-pretty text-muted-foreground sm:text-body-caption">
                      {t("by", { opened: shift.openedByName, closed: shift.closedByName ?? "—" })}
                      {shift.note ? ` · ${shift.note}` : null}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="text-body-small whitespace-nowrap text-muted-foreground tabular-nums sm:text-body-caption">
                      {t("expectedCounted", {
                        expected: number(shift.expectedCash ?? 0),
                        counted: number(shift.countedCash ?? 0),
                      })}
                    </span>
                    <Badge variant={result.variant} appearance="outline" dot>
                      {result.kind === "exact"
                        ? t("result.exact")
                        : t(`result.${result.kind}`, { amount: formatMoney(result.amount, locale) })}
                    </Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
