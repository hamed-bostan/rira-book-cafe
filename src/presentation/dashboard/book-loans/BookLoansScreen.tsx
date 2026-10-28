import { Bookmark, ChevronRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { isBookLoanOverdue, type BookLoan } from "@/src/domain/entities/BookLoan";
import type { BookWaitlistEntry } from "@/src/domain/entities/BookWaitlist";
import {
  BOOK_LOAN_VIEWS,
  type BookLoanCounts,
  type BookLoanView,
  type LendableBook,
} from "@/src/domain/repositories/IBookLoanRepository";
import { Link } from "@/src/i18n/navigation";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { ListSearchInput } from "@/src/presentation/dashboard/list";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

import { DashboardEmptyState } from "../DashboardEmptyState";
import { DashboardLinkTabs } from "../DashboardLinkTabs";

import { BookLoanRow } from "./BookLoanRow";
import { LendBookDialog } from "./LendBookDialog";

type BookLoansScreenProps = {
  /** Every loan matching the search — the tabs filter from it. */
  loans: BookLoan[];
  /** How many loans each tab holds, whatever the search. */
  counts: BookLoanCounts;
  books: LendableBook[];
  /** Everyone in line for a book, front of each line first. */
  waitlist: BookWaitlistEntry[];
  view: BookLoanView;
  /** The search, when one is applied — to tell "nothing here" from "no matches". */
  query: string | undefined;
  now: string;
  today: string;
  canManage: boolean;
};

/** The Overdue tab with the search cleared — every late book. */
const OVERDUE_HREF = "/dashboard/book-loans?view=overdue";

/**
 * The lending book: who has which book and when it's due, in On loan / Overdue /
 * Returned / Lost / All tabs with a search, overdue loans first. The tabs count
 * every loan whatever the search. A card leads to Book holds with a one-line
 * summary of the lines. Presentational: the page fetches over the REST API (BFF);
 * every action `router.refresh()`es.
 */
export async function BookLoansScreen({
  loans,
  counts,
  books,
  waitlist,
  view,
  query,
  now,
  today,
  canManage,
}: BookLoansScreenProps) {
  const t = await getTranslations("dashBookLoans");
  const locale = await getLocale();
  const nowDate = new Date(now);

  const overdue = (loan: BookLoan): boolean => isBookLoanOverdue(loan, nowDate);
  const inView: Record<BookLoanView, (loan: BookLoan) => boolean> = {
    open: (loan) => loan.status === "out",
    overdue,
    returned: (loan) => loan.status === "returned",
    lost: (loan) => loan.status === "lost",
    all: () => true,
  };
  const shown = loans
    .filter(inView[view])
    // Late books first, then what's out by due date, then the rest newest first.
    .sort(
      (a, b) =>
        Number(overdue(b)) - Number(overdue(a)) ||
        (a.status === "out" && b.status === "out" ? a.dueAt.localeCompare(b.dueAt) : b.lentAt.localeCompare(a.lentAt)),
    );

  const lineFor = (productId: string): BookWaitlistEntry[] => waitlist.filter((entry) => entry.productId === productId);
  const ready = waitlist.filter((entry) => entry.status === "notified");
  const waitingCount = waitlist.length - ready.length;
  const booksWithLines = new Set(waitlist.map((entry) => entry.productId)).size;
  const heldFor = Object.fromEntries(ready.map((entry) => [entry.productId, entry.guestName]));

  const hrefFor = (tab: BookLoanView): string => {
    const params = new URLSearchParams();
    if (tab !== "open") params.set("view", tab);
    if (query) params.set("q", query);
    const qs = params.toString();
    return qs ? `/dashboard/book-loans?${qs}` : "/dashboard/book-loans";
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="dashboard-page-title">{t("heading")}</h1>
          <p className="flex flex-wrap items-center gap-x-2 text-body-default text-muted-foreground sm:text-body-small">
            <span>{t("subtitle")}</span>
            {counts.overdue > 0 ? (
              <>
                <span aria-hidden>·</span>
                <Link
                  href={OVERDUE_HREF}
                  // 44px to the touch on a phone without moving the line.
                  className={cn(
                    "-my-3 py-3 font-semibold text-error-foreground underline underline-offset-4 sm:my-0 sm:py-0",
                    focusRing,
                  )}
                >
                  {t("overdueLink", { count: counts.overdue })}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        {canManage ? <LendBookDialog books={books} heldFor={heldFor} today={today} /> : null}
      </div>

      <Link
        href="/dashboard/book-holds"
        className={cn(
          "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card-lg border border-border bg-background px-5 py-4 text-foreground shadow-xs transition-colors hover:border-border-strong",
          focusRing,
        )}
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-button bg-info text-info-foreground">
          <Icon icon={Bookmark} size="icon-lg" />
        </span>
        <span className="flex min-w-0 flex-[1_1_12rem] flex-col">
          <span className="text-body-strong sm:text-body-small-strong">{t("holdsCardTitle")}</span>
          <span className="text-body-default text-muted-foreground sm:text-body-small">
            {waitlist.length === 0
              ? t("holdsNone")
              : `${t("holdsReady", { count: ready.length, formatted: formatNumber(ready.length, locale) })} · ${t(
                  "holdsWaiting",
                  {
                    count: waitingCount,
                    formatted: formatNumber(waitingCount, locale),
                    books: booksWithLines,
                    booksFormatted: formatNumber(booksWithLines, locale),
                  },
                )}`}
          </span>
        </span>
        <span className="flex items-center gap-1 text-body-default font-medium whitespace-nowrap text-primary sm:text-body-small">
          {t("openHolds")}
          <Icon icon={ChevronRight} size="icon-md" className="rtl:-scale-x-100" />
        </span>
      </Link>

      <section
        aria-label={t("loansLabel")}
        className="min-w-0 rounded-card-lg border border-border bg-background shadow-xs"
      >
        <DashboardLinkTabs
          className="px-4"
          label={t("viewLabel")}
          current={view}
          tabs={BOOK_LOAN_VIEWS.map((tab) => ({
            key: tab,
            label: t(`view.${tab}`),
            count: counts[tab],
            href: hrefFor(tab),
          }))}
        />
        <div className="border-b border-border px-4 py-3">
          <ListSearchInput label={t("searchLabel")} placeholder={t("searchPlaceholder")} className="max-w-md" />
        </div>

        {shown.length > 0 ? (
          <ul>
            {shown.map((loan, index) => {
              const line = lineFor(loan.productId);
              return (
                <li key={loan.id} className={cn(index > 0 && "border-t border-border")}>
                  <BookLoanRow
                    loan={loan}
                    now={now}
                    waiting={line.length}
                    firstInLine={line.find((entry) => entry.status === "waiting")?.guestName}
                    canManage={canManage}
                  />
                </li>
              );
            })}
          </ul>
        ) : (
          <DashboardEmptyState
            title={query ? t("noMatchesTitle") : t("emptyTitle")}
            body={query ? t("noMatchesBody") : t("emptyBody")}
          />
        )}
      </section>
    </div>
  );
}
