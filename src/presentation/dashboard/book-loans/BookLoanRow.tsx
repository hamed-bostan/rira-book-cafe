import { BookOpen, MessageSquare, Phone, Users } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { isBookLoanOverdue, type BookLoan } from "@/src/domain/entities/BookLoan";
import { cafeDayOf, cafeDaysBetween } from "@/src/domain/entities/CafeTime";
import { formatCafeDayShort } from "@/src/lib/formatCafeDay";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

import { BookLoanRowActions } from "./BookLoanRowActions";
import { BookLoanStatusBadge } from "./BookLoanStatusBadge";

type BookLoanRowProps = {
  loan: BookLoan;
  /** "Now", from the page — overdue and days left, without a client clock. */
  now: string;
  /** Guests in line for this book (waiting or told it's back). */
  waiting: number;
  /** The guest at the front of this book's line, told when the copy comes back. */
  firstInLine: string | undefined;
  canManage: boolean;
};

/**
 * One loan: the book and its status (with how many guests are queued for it), the
 * borrower, when it went out and who handed it over, when it's due — and how late
 * — any note, and the desk's controls.
 */
export async function BookLoanRow({ loan, now, waiting, firstInLine, canManage }: BookLoanRowProps) {
  const t = await getTranslations("dashBookLoans");
  const locale = await getLocale();

  const nowDate = new Date(now);
  const overdue = isBookLoanOverdue(loan, nowDate);
  const dueDay = cafeDayOf(new Date(loan.dueAt));
  const left = cafeDaysBetween(cafeDayOf(nowDate), dueDay);
  const dueDate = formatCafeDayShort(dueDay, locale);

  const due =
    loan.status === "out"
      ? overdue
        ? {
            text: t("dueOverdue", { date: dueDate, days: -left, formatted: formatNumber(-left, locale) }),
            tone: "font-semibold text-error-foreground",
          }
        : left === 0
          ? { text: t("dueToday"), tone: "font-semibold text-warning-foreground" }
          : { text: t("dueIn", { date: dueDate, days: left, formatted: formatNumber(left, locale) }), tone: "" }
      : loan.status === "returned"
        ? {
            text: t("returnedOn", {
              date: formatCafeDayShort(cafeDayOf(new Date(loan.returnedAt ?? loan.updatedAt)), locale),
            }),
            tone: "",
          }
        : { text: t("wasDue", { date: dueDate }), tone: "" };

  return (
    <article
      aria-label={`L-${loan.reference}, ${loan.bookTitle}, ${loan.borrowerName}`}
      className={cn("flex flex-wrap items-start gap-x-5 gap-y-3 px-5 py-4", loan.status === "returned" && "opacity-70")}
    >
      <div className="flex min-w-0 flex-[1_1_15rem] flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Icon icon={BookOpen} size="sm" className="text-muted-foreground" />
          <span className="text-body-strong text-foreground sm:text-body-small-strong">{loan.bookTitle}</span>
          {loan.bookAuthor ? (
            <span className="text-body-default text-muted-foreground sm:text-body-small">{loan.bookAuthor}</span>
          ) : null}
          <BookLoanStatusBadge status={loan.status} overdue={overdue} outlined />
          {loan.status === "out" && waiting > 0 ? (
            <span className="inline-flex h-6 items-center gap-1.5 rounded-badge-md border border-info-border bg-info px-2 text-body-caption-bold whitespace-nowrap text-info-foreground">
              <Icon icon={Users} size="xs" />
              {t("peopleWaiting", { count: waiting, formatted: formatNumber(waiting, locale) })}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-default sm:text-body-small">
          <span className="font-medium text-foreground">{loan.borrowerName}</span>
          <a
            href={`tel:${loan.borrowerPhone.replace(/\s/g, "")}`}
            dir="ltr"
            // 44px to the touch on a phone without moving the row.
            className={cn(
              "-my-3 flex items-center gap-1.5 py-3 whitespace-nowrap text-foreground/80 tabular-nums transition-colors hover:text-primary sm:my-0 sm:py-0",
              focusRing,
            )}
          >
            <Icon icon={Phone} size="sm" className="text-muted-foreground" />
            {loan.borrowerPhone}
          </a>
        </div>
        <p className="flex flex-wrap gap-x-1.5 text-body-small text-muted-foreground tabular-nums sm:text-body-caption">
          <span>
            L-{loan.reference} ·{" "}
            {t("lentOn", { date: formatCafeDayShort(cafeDayOf(new Date(loan.lentAt)), locale), by: loan.lentByName })}
          </span>
          <span aria-hidden>·</span>
          <span className={due.tone}>{due.text}</span>
        </p>
        {loan.note ? (
          <p className="flex items-start gap-1.5 text-body-default text-pretty text-muted-foreground sm:text-body-small">
            <Icon icon={MessageSquare} size="sm" className="mt-0.5 shrink-0" />
            {loan.note}
          </p>
        ) : null}
      </div>

      {canManage && loan.status !== "returned" ? <BookLoanRowActions loan={loan} firstInLine={firstInLine} /> : null}
    </article>
  );
}
