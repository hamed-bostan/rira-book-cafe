import { auth } from "@/auth";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { BOOK_LOAN_VIEWS, type BookLoanView } from "@/src/domain/repositories/IBookLoanRepository";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { sessionHas } from "@/src/lib/require-permission";
import { bookLoansServerApi } from "@/src/presentation/dashboard/book-loans/book-loan-server-api";
import { BookLoansScreen } from "@/src/presentation/dashboard/book-loans/BookLoansScreen";

// The lending book is fetched over the REST API (BFF) during server render. Every
// loan still out plus the latest closed ones are read at once and the tabs filter
// them; each tab's count covers every loan, whatever the search. The tab
// (`?view=`, default open) and search (`?q=`) live in the query string.
export const dynamic = "force-dynamic";

type DashboardBookLoansPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const VIEW_SET = new Set<string>(BOOK_LOAN_VIEWS);

export default async function DashboardBookLoansPage({ searchParams }: DashboardBookLoansPageProps) {
  const params = toSearchParams(await searchParams);
  const viewParam = params.get("view");
  const view = viewParam && VIEW_SET.has(viewParam) ? (viewParam as BookLoanView) : "open";
  const q = params.get("q")?.trim() || undefined;

  const [open, recent, counts, books, waitlist, canManage] = await Promise.all([
    bookLoansServerApi.list("open", q),
    bookLoansServerApi.list("all", q),
    bookLoansServerApi.getCounts(),
    bookLoansServerApi.listBooks(),
    bookLoansServerApi.listWaitlist(),
    auth().then((session) => sessionHas(session, "loans.manage")),
  ]);
  // "All" is capped to the newest loans; every loan still out is kept on top of it.
  const loans = [...open, ...recent.filter((loan) => loan.status !== "out")];

  const now = new Date();
  return (
    <BookLoansScreen
      loans={loans}
      counts={counts}
      books={books}
      waitlist={waitlist}
      view={view}
      query={q}
      now={now.toISOString()}
      today={cafeDayOf(now)}
      canManage={canManage}
    />
  );
}
