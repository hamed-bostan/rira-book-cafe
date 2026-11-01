import { Plus } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { BankStatementSummary } from "@/src/domain/entities/BankReconciliation";
import type { Account } from "@/src/domain/entities/Ledger";
import { Link } from "@/src/i18n/navigation";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { AccountingHeader } from "@/src/presentation/dashboard/accounting/AccountingHeader";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { DashboardEmptyState } from "../DashboardEmptyState";
import { AMOUNT, PAGE_CARD, ROW_CAPTION, ROW_TEXT, TABLE_HEAD, TABLE_TD, TABLE_TH } from "../pageStyles";
import { DashboardPageCrumb } from "../shell/DashboardPageCrumb";

/** Bank statements by period, newest first, with how far each is from reconciled. */
export async function BankStatementsScreen({
  statements,
  canWrite,
  writer,
}: {
  statements: BankStatementSummary[];
  canWrite: boolean;
  /** What the header's "New manual entry" needs, for a viewer who can write to the books. */
  writer: { accounts: Account[]; today: string } | null;
}) {
  const t = await getTranslations("dashBank");
  const tAccounting = await getTranslations("dashAccounting");
  const locale = await getLocale();

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardPageCrumb label={tAccounting("tab.bank")} />
      <AccountingHeader active="bank" subtitle={t("subtitle")} writer={writer} />

      {canWrite ? (
        <div className="flex">
          <Button asChild variant="secondary" size="control-md" className="px-3">
            <Link href="/dashboard/accounting/bank/new">
              <Icon icon={Plus} size="icon-md" className="me-2" />
              {t("newStatement")}
            </Link>
          </Button>
        </div>
      ) : null}

      <section aria-label={t("heading")} className={cn(PAGE_CARD, "overflow-hidden")}>
        {statements.length === 0 ? (
          <DashboardEmptyState title={t("emptyTitle")} body={t("empty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className={cn(ROW_TEXT, "w-full min-w-xl table-fixed")}>
              <thead className={TABLE_HEAD}>
                <tr>
                  <th scope="col" className={TABLE_TH}>
                    {t("col.period")}
                  </th>
                  <th scope="col" className={cn(TABLE_TH, "w-40 text-end")}>
                    {t("col.opening")}
                  </th>
                  <th scope="col" className={cn(TABLE_TH, "w-40 text-end")}>
                    {t("col.closing")}
                  </th>
                  <th scope="col" className={cn(TABLE_TH, "w-24 text-end")}>
                    {t("col.lines")}
                  </th>
                  <th scope="col" className={cn(TABLE_TH, "w-56 text-end")}>
                    {t("col.status")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {statements.map((statement) => (
                  <tr key={statement.id}>
                    <td className={cn(TABLE_TD, "align-middle")}>
                      <Link
                        href={`/dashboard/accounting/bank/${statement.id}`}
                        className="font-medium text-primary hover:text-primary-hover"
                      >
                        {formatCafeDayMedium(statement.fromDay, locale)} –{" "}
                        {formatCafeDayMedium(statement.toDay, locale)}
                      </Link>
                    </td>
                    <td className={cn(TABLE_TD, AMOUNT, "align-middle text-foreground")}>
                      {formatNumber(statement.openingBalance, locale)}
                    </td>
                    <td className={cn(TABLE_TD, AMOUNT, "align-middle text-foreground")}>
                      {formatNumber(statement.closingBalance, locale)}
                    </td>
                    <td className={cn(TABLE_TD, AMOUNT, "align-middle")}>
                      {formatNumber(statement.lineCount, locale)}
                    </td>
                    <td className={cn(TABLE_TD, "align-middle")}>
                      <span className="flex flex-wrap items-center justify-end gap-2">
                        {statement.unmatchedCount > 0 ? (
                          <span className={ROW_CAPTION}>
                            {t("unmatchedCount", { count: statement.unmatchedCount })}
                          </span>
                        ) : null}
                        <Badge
                          size="compact"
                          appearance="outline"
                          variant={statement.status === "reconciled" ? "success" : "warning"}
                        >
                          {t(`status.${statement.status}`)}
                        </Badge>
                      </span>
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
