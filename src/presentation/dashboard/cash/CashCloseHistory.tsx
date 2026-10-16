import { getLocale, getTranslations } from "next-intl/server";

import type { CashClose } from "@/src/domain/entities/CashClose";
import type { Page } from "@/src/domain/entities/Pagination";
import { Link } from "@/src/i18n/navigation";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatMoney } from "@/src/lib/formatMoney";
import { ListPager } from "@/src/presentation/dashboard/list";

import { DifferenceText } from "./DifferenceText";

/** Every close, newest first: what was expected, counted and deposited, and who closed. */
export async function CashCloseHistory({ page, canViewBooks }: { page: Page<CashClose>; canViewBooks: boolean }) {
  const t = await getTranslations("dashCash");
  const locale = await getLocale();

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <h2 className="text-body-lead text-foreground">{t("history.heading")}</h2>
      <div className="min-w-0 overflow-hidden rounded-card-lg border border-border bg-background">
        {page.items.length === 0 ? (
          <p className="px-6 py-12 text-center text-body-small-emphasis text-muted-foreground">{t("history.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-body-small">
              <thead className="bg-surface text-body-caption text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 text-start font-medium">{t("history.day")}</th>
                  <th scope="col" className="px-4 py-3 text-end font-medium">{t("history.expected")}</th>
                  <th scope="col" className="px-4 py-3 text-end font-medium">{t("history.counted")}</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">{t("history.difference")}</th>
                  <th scope="col" className="px-4 py-3 text-end font-medium">{t("history.deposited")}</th>
                  <th scope="col" className="px-4 py-3 text-end font-medium">{t("history.closingFloat")}</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">{t("history.closedBy")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {page.items.map((close) => (
                  <tr key={close.id}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-foreground">
                      {formatCafeDayMedium(close.day, locale)}
                      {close.entryId && close.entryNumber && canViewBooks ? (
                        <Link href={`/dashboard/accounting/journal/${close.entryId}`} className="ms-2 text-body-caption text-primary underline-offset-4 hover:underline">
                          JE-{close.entryNumber}
                        </Link>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-end text-muted-foreground">{formatMoney(close.expected, locale)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-end text-foreground">{formatMoney(close.counted, locale)}</td>
                    <td className="px-4 py-2.5">
                      <DifferenceText difference={close.difference} />
                      {close.note ? (
                        <span className="block text-body-caption text-muted-foreground" dir="auto">
                          {close.note}
                        </span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-end">{close.deposited > 0 ? formatMoney(close.deposited, locale) : "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-end">{formatMoney(close.closingFloat, locale)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{close.closedByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-border px-4 py-3">
          <ListPager page={page} />
        </div>
      </div>
    </section>
  );
}
