import { Banknote, CreditCard, Globe, Wallet } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { formatCompactDateTime } from "@/src/lib/formatOrderDate";
import { cn } from "@/src/lib/utils";
import { AutoRefresh } from "@/src/presentation/components/AutoRefresh";
import { DashboardPanel, DashboardPanelHeader } from "@/src/presentation/dashboard/DashboardPanel";
import { StatCard } from "@/src/presentation/dashboard/StatCard";

import { CloseShiftForm, OpenShiftForm } from "./CashShiftForms";

import type { CashShiftOverview } from "./cash-shift-response-schema";

/**
 * The till: the open shift with what the drawer should hold so far (and what went
 * to the bank and the gateway), the form that closes it by counting the drawer,
 * and past shifts with their over/short. Presentational — the page fetches over
 * the REST API; the open shift's figures refresh while the page is open.
 */
export async function CashShiftsScreen({ overview }: { overview: CashShiftOverview }) {
  const t = await getTranslations("dashCashShifts");
  const locale = await getLocale();
  const { current, recent } = overview;
  const closed = recent.filter((shift) => shift.status === "closed");

  const when = (iso: string) => {
    const parts = formatCompactDateTime(iso, locale);
    return `${parts.date} ${parts.time}`;
  };

  return (
    <div className="@container flex min-w-0 flex-col gap-4 sm:gap-6">
      <div className="space-y-1">
        <h1 className="dashboard-page-title">{t("heading")}</h1>
        <p className="text-body-small text-muted-foreground">{t("subtitle")}</p>
      </div>

      {current ? (
        <>
          <AutoRefresh intervalSeconds={60} />
          <DashboardPanel>
            <DashboardPanelHeader title={t("openShift", { number: formatNumber(current.shift.number, locale) })} />
            <p className="mt-1 text-body-small text-muted-foreground">
              {t("openedBy", { name: current.shift.openedByName, date: when(current.shift.openedAt) })}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 @min-[50rem]:grid-cols-4">
              <StatCard label={t("float")} value={formatMoney(current.shift.openingFloat, locale)} icon={Wallet} tone="info" />
              <StatCard label={t("expected")} value={formatMoney(current.expectedCash, locale)} icon={Banknote} tone="brand" />
              <StatCard label={t("bank")} value={formatMoney(current.movements.bank, locale)} icon={CreditCard} tone="info" />
              <StatCard label={t("online")} value={formatMoney(current.movements.online, locale)} icon={Globe} tone="info" />
            </div>
            <p className="mt-3 text-body-caption text-muted-foreground">
              {t("paymentsCount", { count: current.movements.payments, formatted: formatNumber(current.movements.payments, locale) })}
            </p>
          </DashboardPanel>
          <DashboardPanel>
            <DashboardPanelHeader title={t("closeHeading")} />
            <p className="mt-1 text-body-small text-muted-foreground">{t("closeDescription")}</p>
            <div className="mt-4 max-w-md">
              <CloseShiftForm shiftId={current.shift.id} expectedCash={current.expectedCash} />
            </div>
          </DashboardPanel>
        </>
      ) : (
        <DashboardPanel>
          <DashboardPanelHeader title={t("openHeading")} />
          <p className="mt-1 text-body-small text-muted-foreground">{t("openDescription")}</p>
          <div className="mt-4 max-w-md">
            <OpenShiftForm />
          </div>
        </DashboardPanel>
      )}

      <DashboardPanel>
        <DashboardPanelHeader title={t("historyHeading")} />
        {closed.length === 0 ? (
          <p className="mt-4 text-body-small text-muted-foreground">{t("historyEmpty")}</p>
        ) : (
          <ul className="mt-4 flex flex-col divide-y divide-border">
            {closed.map((shift) => {
              const difference = shift.difference ?? 0;
              return (
                <li key={shift.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-body-small-strong text-foreground">
                      Z-{shift.number} · {shift.closedAt ? when(shift.closedAt) : null}
                    </p>
                    <p className="text-body-caption text-muted-foreground">
                      {t("by", { opened: shift.openedByName, closed: shift.closedByName ?? "—" })}
                      {shift.note ? ` · ${shift.note}` : null}
                    </p>
                  </div>
                  <div className="text-end text-body-caption text-muted-foreground">
                    <p>{t("expectedCounted", { expected: formatMoney(shift.expectedCash ?? 0, locale), counted: formatMoney(shift.countedCash ?? 0, locale) })}</p>
                    <p
                      className={cn(
                        "text-body-small-strong",
                        difference === 0 ? "text-success-foreground" : difference > 0 ? "text-info-foreground" : "text-error-foreground",
                      )}
                    >
                      {difference === 0
                        ? t("exact")
                        : difference > 0
                          ? t("over", { amount: formatMoney(difference, locale) })
                          : t("short", { amount: formatMoney(-difference, locale) })}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DashboardPanel>
    </div>
  );
}
