import { Landmark } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { BankStatementSummary } from "@/src/domain/entities/BankReconciliation";
import type { Account } from "@/src/domain/entities/Ledger";
import { Link } from "@/src/i18n/navigation";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { AccountingHeader } from "@/src/presentation/dashboard/accounting/AccountingHeader";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { EmptyState } from "@/src/presentation/design-system/components/EmptyState/EmptyState";

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
  const locale = await getLocale();

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <AccountingHeader active="bank" intro={t("subtitle")} writer={writer} />

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
                  <th scope="col" className="px-4 py-3 text-start font-medium">
                    {t("col.period")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-end font-medium">
                    {t("col.opening")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-end font-medium">
                    {t("col.closing")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-end font-medium">
                    {t("col.lines")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">
                    {t("col.status")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {statements.map((statement) => (
                  <tr key={statement.id}>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <Link
                        href={`/dashboard/accounting/bank/${statement.id}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {formatCafeDayMedium(statement.fromDay, locale)} –{" "}
                        {formatCafeDayMedium(statement.toDay, locale)}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-end whitespace-nowrap text-muted-foreground">
                      {formatMoney(statement.openingBalance, locale)}
                    </td>
                    <td className="px-4 py-2.5 text-end whitespace-nowrap text-foreground">
                      {formatMoney(statement.closingBalance, locale)}
                    </td>
                    <td className="px-4 py-2.5 text-end whitespace-nowrap">
                      {formatNumber(statement.lineCount, locale)}
                      {statement.unmatchedCount > 0 ? (
                        <span className="block text-body-caption text-warning-foreground">
                          {t("unmatchedCount", { count: statement.unmatchedCount })}
                        </span>
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
