import { BookOpen, StickyNote } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { isBookLoanOverdue, type BookLoan } from "@/src/domain/entities/BookLoan";
import { formatOrderDate } from "@/src/lib/formatOrderDate";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { BookLoanActions } from "./BookLoanActions";
import { BookLoanStatusBadge } from "./BookLoanStatusBadge";

type BookLoanCardProps = {
  loan: BookLoan;
  /** "Now", from the page, so overdue is judged on the server's clock. */
  now: Date;
  /** Whether to draw the return / lost controls. */
  canManage: boolean;
};

/** One loan: the book, who has it, when it went out and when it's due, and the controls to close it. */
export async function BookLoanCard({ loan, now, canManage }: BookLoanCardProps) {
  const t = await getTranslations("dashBookLoans");
  const locale = await getLocale();
  const overdue = isBookLoanOverdue(loan, now);

  return (
    <li className="flex flex-col gap-3 rounded-card-md border border-border bg-background p-4 @min-[40rem]:flex-row @min-[40rem]:items-start">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Icon icon={BookOpen} size="xs" className="text-muted-foreground" />
          <span className="text-body-small-strong text-foreground">{loan.bookTitle}</span>
          {loan.bookAuthor ? <span className="text-body-small text-muted-foreground">{loan.bookAuthor}</span> : null}
          <BookLoanStatusBadge status={loan.status} overdue={overdue} />
        </div>
        <p className="text-body-small text-foreground">
          {loan.borrowerName}{" "}
          <span dir="ltr" className="text-muted-foreground">
            {loan.borrowerPhone}
          </span>
        </p>
        <p className="text-body-caption text-muted-foreground">
          L-{loan.reference} · {t("lentOn", { date: formatOrderDate(loan.lentAt, locale), by: loan.lentByName })} ·{" "}
          <span className={overdue ? "text-warning-foreground" : undefined}>
            {t("dueOnDate", { date: formatOrderDate(loan.dueAt, locale) })}
          </span>
          {loan.returnedAt ? ` · ${t("returnedOn", { date: formatOrderDate(loan.returnedAt, locale) })}` : null}
        </p>
        {loan.note ? (
          <p className="flex items-start gap-1.5 text-body-small text-warning-foreground">
            <Icon icon={StickyNote} size="xs" className="mt-0.5 shrink-0" />
            {loan.note}
          </p>
        ) : null}
      </div>

      {canManage ? (
        <div className="shrink-0">
          <BookLoanActions loan={loan} />
        </div>
      ) : null}
    </li>
  );
}
