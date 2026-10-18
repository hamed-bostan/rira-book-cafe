import { getLocale, getTranslations } from "next-intl/server";

import type { TrialBalance } from "@/src/domain/entities/AccountingReports";
import { Link } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";

import { accountName } from "./accounting-format";
import { BalanceCheck } from "./BalanceCheck";
import { StatementHeader } from "./StatementHeader";

/** Every account with movement, netted to its debit or credit side, and the two columns' totals. */
export async function TrialBalanceScreen({ report }: { report: TrialBalance }) {
  const t = await getTranslations("dashAccounting");
  const locale = await getLocale();

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <StatementHeader
        title={t("statements.trial-balance.title")}
        subtitle={t("statements.trial-balance.subtitle")}
        span={report}
      />
      <BalanceCheck ok={report.balanced} okLabel={t("tb.balanced")} failLabel={t("tb.unbalanced")} />
      <section className="min-w-0 overflow-x-auto rounded-card-lg border border-border bg-background">
        <table className="w-full min-w-[32rem] text-body-small">
          <thead className="bg-surface text-body-caption text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 text-start font-medium">
                {t("entry.colAccount")}
              </th>
              <th scope="col" className="px-4 py-3 text-end font-medium">
                {t("entry.colDebit")}
              </th>
              <th scope="col" className="px-4 py-3 text-end font-medium">
                {t("entry.colCredit")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {report.rows.map((row) => {
              const net = row.debit - row.credit;
              return (
                <tr key={row.account.code}>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/dashboard/accounting/accounts/${row.account.code}`}
                      className="text-foreground underline-offset-4 hover:underline"
                    >
                      <span className="me-2 font-mono text-muted-foreground" dir="ltr">
                        {row.account.code}
                      </span>
                      {accountName(row.account, locale)}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-end whitespace-nowrap">{net > 0 ? formatMoney(net, locale) : ""}</td>
                  <td className="px-4 py-2.5 text-end whitespace-nowrap">{net < 0 ? formatMoney(-net, locale) : ""}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t border-border bg-surface text-body-small-emphasis">
            <tr>
              <th scope="row" className="px-4 py-3 text-start">
                {t("entry.totals")}
              </th>
              <td className="px-4 py-3 text-end whitespace-nowrap">{formatMoney(report.totalDebit, locale)}</td>
              <td className="px-4 py-3 text-end whitespace-nowrap">{formatMoney(report.totalCredit, locale)}</td>
            </tr>
          </tfoot>
        </table>
      </section>
    </div>
  );
}
