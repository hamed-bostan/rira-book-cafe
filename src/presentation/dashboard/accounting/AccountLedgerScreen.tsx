import { ChevronRight, ScrollText } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { AccountLedger } from "@/src/domain/entities/AccountingReports";
import { Link } from "@/src/i18n/navigation";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatMoney } from "@/src/lib/formatMoney";
import { Badge, EmptyState } from "@/src/presentation/design-system";

import { accountName } from "./accounting-format";
import { PeriodPicker } from "./PeriodPicker";

/** One account's movements over a period, opening to closing, with a running balance. */
export async function AccountLedgerScreen({ ledger }: { ledger: AccountLedger }) {
  const t = await getTranslations("dashAccounting");
  const locale = await getLocale();
  const { account } = ledger;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <nav aria-label={t("breadcrumbLabel")} className="flex items-center gap-2 text-body-caption text-muted-foreground">
        <Link href="/dashboard/accounting/accounts" className="hover:text-foreground">
          {t("accounts.heading")}
        </Link>
        <ChevronRight className="size-3.5 rtl:rotate-180" aria-hidden />
        <span className="font-medium text-foreground">{account.code}</span>
      </nav>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="dashboard-page-title">
          <span dir="ltr">{account.code}</span> · {accountName(account, locale)}
        </h1>
        <Badge size="sm" variant="neutral">
          {t(`accountType.${account.type}`)}
        </Badge>
      </div>

      <div className="rounded-card-lg border border-border bg-background p-4 md:p-6">
        <PeriodPicker fromDay={ledger.fromDay} toDay={ledger.toDay} />
      </div>

      <section className="min-w-0 overflow-x-auto rounded-card-lg border border-border bg-background">
        <table className="w-full min-w-[40rem] text-body-small">
          <thead className="bg-surface text-body-caption text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 text-start font-medium">{t("journal.colDate")}</th>
              <th scope="col" className="px-4 py-3 text-start font-medium">{t("journal.colNumber")}</th>
              <th scope="col" className="px-4 py-3 text-start font-medium">{t("journal.colDescription")}</th>
              <th scope="col" className="px-4 py-3 text-end font-medium">{t("entry.colDebit")}</th>
              <th scope="col" className="px-4 py-3 text-end font-medium">{t("entry.colCredit")}</th>
              <th scope="col" className="px-4 py-3 text-end font-medium">{t("ledger.colBalance")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr className="bg-surface/50">
              <td colSpan={5} className="px-4 py-3 text-body-small-emphasis text-muted-foreground">
                {t("ledger.opening")}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-end text-body-small-emphasis">{formatMoney(ledger.openingBalance, locale)}</td>
            </tr>
            {ledger.lines.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState icon={ScrollText} title={t("ledger.empty")} className="py-10" />
                </td>
              </tr>
            ) : (
              ledger.lines.map((line, index) => (
                <tr key={`${line.entryId}-${index}`}>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatCafeDayMedium(line.date, locale)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/accounting/journal/${line.entryId}`} className="text-primary underline-offset-4 hover:underline">
                      JE-{line.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-foreground" dir="auto">
                    {line.memo ?? line.description}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-end">{line.debit ? formatMoney(line.debit, locale) : ""}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-end">{line.credit ? formatMoney(line.credit, locale) : ""}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-end text-body-small-emphasis">{formatMoney(line.runningBalance, locale)}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="border-t border-border bg-surface text-body-small-emphasis">
            <tr>
              <th scope="row" colSpan={5} className="px-4 py-3 text-start">
                {t("ledger.closing")}
              </th>
              <td className="whitespace-nowrap px-4 py-3 text-end">{formatMoney(ledger.closingBalance, locale)}</td>
            </tr>
          </tfoot>
        </table>
      </section>
    </div>
  );
}
