import { Landmark } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { BankStatementSummary } from "@/src/domain/entities/BankReconciliation";
import { Link } from "@/src/i18n/navigation";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { AccountingTabs } from "@/src/presentation/dashboard/accounting/AccountingTabs";
import { Badge, Button, EmptyState } from "@/src/presentation/design-system";

/** Bank statements by period, newest first, with how far each is from reconciled. */
export async function BankStatementsScreen({ statements, canWrite }: { statements: BankStatementSummary[]; canWrite: boolean }) {
  const t = await getTranslations("dashBank");
  const tAccounting = await getTranslations("dashAccounting");
  const locale = await getLocale();

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <AccountingTabs active="bank" title={tAccounting("heading")} subtitle={t("subtitle")} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-body-lead text-foreground">{t("heading")}</h2>
        {canWrite ? (
          <Button asChild size="sm">
            <Link href="/dashboard/accounting/bank/new">{t("newStatement")}</Link>
          </Button>
        ) : null}
      </div>

      <section className="min-w-0 overflow-hidden rounded-card-lg border border-border bg-background">
        {statements.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title={t("emptyTitle")}
            description={t("empty")}
            action={
              canWrite ? (
                <Button asChild size="sm">
                  <Link href="/dashboard/accounting/bank/new">{t("newStatement")}</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-body-small">
              <thead className="bg-surface text-body-caption text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 text-start font-medium">{t("col.period")}</th>
                  <th scope="col" className="px-4 py-3 text-end font-medium">{t("col.opening")}</th>
                  <th scope="col" className="px-4 py-3 text-end font-medium">{t("col.closing")}</th>
                  <th scope="col" className="px-4 py-3 text-end font-medium">{t("col.lines")}</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">{t("col.status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {statements.map((statement) => (
                  <tr key={statement.id}>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <Link href={`/dashboard/accounting/bank/${statement.id}`} className="text-primary underline-offset-4 hover:underline">
                        {formatCafeDayMedium(statement.fromDay, locale)} – {formatCafeDayMedium(statement.toDay, locale)}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-end text-muted-foreground">{formatMoney(statement.openingBalance, locale)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-end text-foreground">{formatMoney(statement.closingBalance, locale)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-end">
                      {formatNumber(statement.lineCount, locale)}
                      {statement.unmatchedCount > 0 ? (
                        <span className="block text-body-caption text-warning-foreground">{t("unmatchedCount", { count: statement.unmatchedCount })}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge size="sm" variant={statement.status === "reconciled" ? "success" : "warning"}>
                        {t(`status.${statement.status}`)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
