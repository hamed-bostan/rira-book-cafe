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
import { PAGE_CARD, ROW_CAPTION, ROW_TEXT, TABLE_HEAD, TABLE_TH } from "../pageStyles";
import { DashboardPageCrumb } from "../shell/DashboardPageCrumb";
import { STACKED_TABLE } from "../stackedTableStyles";

const S = STACKED_TABLE.wide;

/**
 * Bank statements by period, newest first, with how far each is from reconciled.
 * On a narrow card each period sits over its balances and status, labelled.
 */
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

      <section aria-label={t("heading")} className={cn(PAGE_CARD, S.frame, "overflow-hidden")}>
        {statements.length === 0 ? (
          <DashboardEmptyState title={t("emptyTitle")} body={t("empty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className={cn(ROW_TEXT, S.table)}>
              <thead className={cn(TABLE_HEAD, S.head)}>
                <tr>
                  <th scope="col" className={TABLE_TH}>
                    {t("col.period")}
                  </th>
                  <th scope="col" className={cn(TABLE_TH, "w-36 text-end")}>
                    {t("col.opening")}
                  </th>
                  <th scope="col" className={cn(TABLE_TH, "w-36 text-end")}>
                    {t("col.closing")}
                  </th>
                  <th scope="col" className={cn(TABLE_TH, "w-20 text-end")}>
                    {t("col.lines")}
                  </th>
                  <th scope="col" className={cn(TABLE_TH, "w-52 text-end")}>
                    {t("col.status")}
                  </th>
                </tr>
              </thead>
              <tbody className={cn(S.body, "divide-y divide-border")}>
                {statements.map((statement) => (
                  <tr key={statement.id} className={S.row}>
                    <td className={cn(S.lead, "align-middle")}>
                      <Link
                        href={`/dashboard/accounting/bank/${statement.id}`}
                        className="font-medium text-primary hover:text-primary-hover"
                      >
                        {formatCafeDayMedium(statement.fromDay, locale)} –{" "}
                        {formatCafeDayMedium(statement.toDay, locale)}
                      </Link>
                    </td>
                    <td className={cn(S.cell, S.amount, "align-middle text-foreground")}>
                      <span className={S.label}>{t("col.opening")}</span>
                      {formatNumber(statement.openingBalance, locale)}
                    </td>
                    <td className={cn(S.cell, S.amount, "align-middle text-foreground")}>
                      <span className={S.label}>{t("col.closing")}</span>
                      {formatNumber(statement.closingBalance, locale)}
                    </td>
                    <td className={cn(S.cell, S.amount, "align-middle")}>
                      <span className={S.label}>{t("col.lines")}</span>
                      {formatNumber(statement.lineCount, locale)}
                    </td>
                    <td className={cn(S.cell, S.amount, "align-middle")}>
                      <span className={S.label}>{t("col.status")}</span>
                      {/* Inline, so the column's end alignment carries it; stacked, it's a line of its own. */}
                      <span className="inline-flex flex-wrap items-center gap-2">
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
