import { getLocale, getTranslations } from "next-intl/server";

import { isBookLoanOverdue, type BookLoan } from "@/src/domain/entities/BookLoan";
import { formatOrderDate } from "@/src/lib/formatOrderDate";
import { BookLoanStatusBadge } from "@/src/presentation/dashboard/book-loans/BookLoanStatusBadge";

type MyBookLoansScreenProps = {
  loans: BookLoan[];
  /** "Now", from the page, so overdue is judged without a client clock. */
  now: string;
};

/** The books the guest has borrowed from the shelf: what they still have and when it's due back. */
export async function MyBookLoansScreen({ loans, now }: MyBookLoansScreenProps) {
  const t = await getTranslations("site");
  const locale = await getLocale();
  const nowDate = new Date(now);
  const out = loans.filter((loan) => loan.status === "out");
  const closed = loans.filter((loan) => loan.status !== "out");

  function row(loan: BookLoan) {
    const overdue = isBookLoanOverdue(loan, nowDate);
    return (
      <li key={loan.id} className="flex flex-wrap items-center gap-3 rounded-card-md border border-border p-4">
        <div className="min-w-0 flex-1">
          <p className="text-body-small-strong text-foreground">{loan.bookTitle}</p>
          <p className="text-body-caption text-muted-foreground">
            {loan.bookAuthor ? `${loan.bookAuthor} · ` : null}
            {loan.status === "returned" && loan.returnedAt
              ? t("loans.returnedOn", { date: formatOrderDate(loan.returnedAt, locale) })
              : t("loans.dueOn", { date: formatOrderDate(loan.dueAt, locale) })}
          </p>
        </div>
        <BookLoanStatusBadge status={loan.status} overdue={overdue} />
      </li>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-heading-page text-foreground">{t("loans.heading")}</h1>
        <p className="mt-1 text-body-small text-muted-foreground">{t("loans.subtitle")}</p>
      </div>
      {out.length === 0 ? (
        <p className="rounded-card-lg border border-dashed border-border px-6 py-10 text-center text-body-small text-muted-foreground">
          {t("loans.empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">{out.map(row)}</ul>
      )}
      {closed.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-body-lead text-foreground">{t("loans.past")}</h2>
          <ul className="flex flex-col gap-3 opacity-80">{closed.slice(0, 20).map(row)}</ul>
        </section>
      ) : null}
    </div>
  );
}
