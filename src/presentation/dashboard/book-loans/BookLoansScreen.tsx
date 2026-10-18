import { BookOpen, Search } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { isBookLoanOverdue, type BookLoan } from "@/src/domain/entities/BookLoan";
import type { BookWaitlistEntry } from "@/src/domain/entities/BookWaitlist";
import { BOOK_LOAN_VIEWS, type BookLoanView, type LendableBook } from "@/src/domain/repositories/IBookLoanRepository";
import { ListFilterSelect, ListSearchInput } from "@/src/presentation/dashboard/list";
import { EmptyState } from "@/src/presentation/design-system/components/EmptyState/EmptyState";

import { BookLoanCard } from "./BookLoanCard";
import { BookWaitlistSection } from "./BookWaitlistSection";
import { LendBookDialog } from "./LendBookDialog";

type BookLoansScreenProps = {
  loans: BookLoan[];
  books: LendableBook[];
  /** Guests in line for books that are out. */
  waitlist: BookWaitlistEntry[];
  view: BookLoanView;
  /** Whether a search term is applied — to tell "nothing out" from "no matches". */
  isSearching: boolean;
  /** "Now" and today (cafe calendar), from the page. */
  now: string;
  today: string;
  canManage: boolean;
};

/**
 * The shelf's lending book: who has which book and when it's due back. Presentational:
 * the page fetches over the REST API (BFF). The view and search live in the URL;
 * every action `router.refresh()`es.
 */
export async function BookLoansScreen({
  loans,
  books,
  waitlist,
  view,
  isSearching,
  now,
  today,
  canManage,
}: BookLoansScreenProps) {
  const t = await getTranslations("dashBookLoans");
  const nowDate = new Date(now);
  const overdueCount = loans.filter((loan) => isBookLoanOverdue(loan, nowDate)).length;

  return (
    <div className="@container flex min-w-0 flex-col gap-4 sm:gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="dashboard-page-title">{t("heading")}</h1>
            <p className="text-body-small text-muted-foreground">{t("subtitle")}</p>
          </div>
          {canManage ? <LendBookDialog books={books} today={today} /> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ListSearchInput label={t("searchLabel")} placeholder={t("searchPlaceholder")} className="min-w-56 flex-1" />
          <div className="min-w-48">
            <ListFilterSelect
              className="h-9 w-full"
              paramName="view"
              label={t("viewLabel")}
              options={BOOK_LOAN_VIEWS.map((option) => ({
                // `open` is the default, so it's the param-less option.
                value: option === "open" ? "" : option,
                label: t("viewOption", { view: t(`view.${option}`) }),
              }))}
            />
          </div>
        </div>
        {view === "open" && overdueCount > 0 ? (
          <p className="rounded-card-md bg-warning px-3 py-2 text-body-small text-warning-foreground">
            {t("overdueSummary", { count: overdueCount })}
          </p>
        ) : null}
      </div>

      <BookWaitlistSection entries={waitlist} canManage={canManage} />

      {loans.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {loans.map((loan) => (
            <BookLoanCard key={loan.id} loan={loan} now={nowDate} canManage={canManage} />
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={isSearching ? Search : BookOpen}
          title={isSearching ? t("noMatchesTitle") : t("emptyTitle")}
          description={isSearching ? t("noMatchesBody") : t("emptyBody")}
          className="rounded-card-lg border border-dashed border-border"
        />
      )}
    </div>
  );
}
