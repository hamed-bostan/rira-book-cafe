import { auth } from "@/auth";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { BOOK_LOAN_VIEWS, type BookLoanView } from "@/src/domain/repositories/IBookLoanRepository";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { sessionHas } from "@/src/lib/require-permission";
import { bookLoansServerApi } from "@/src/presentation/dashboard/book-loans/book-loan-server-api";
import { BookLoansScreen } from "@/src/presentation/dashboard/book-loans/BookLoansScreen";
import { withRememberedPageSize } from "@/src/presentation/dashboard/list/withRememberedPageSize";

// The lending book is fetched over the REST API (BFF) during server render: one
// page of the current tab, filtered and ordered on the server, and each tab's
// count over every loan, whatever the search. The tab (`?view=`, default open),
// search (`?q=`) and paging (`?page=`, `?pageSize=`) live in the query string.
export const dynamic = "force-dynamic";

type DashboardBookLoansPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const VIEW_SET = new Set<string>(BOOK_LOAN_VIEWS);

export default async function DashboardBookLoansPage({ searchParams }: DashboardBookLoansPageProps) {
  const params = await withRememberedPageSize(toSearchParams(await searchParams));
  const viewParam = params.get("view");
  const view = viewParam && VIEW_SET.has(viewParam) ? (viewParam as BookLoanView) : "open";
  const q = params.get("q")?.trim() || undefined;

  // A tab name the page doesn't know reads as On loan, as it's drawn.
  const listParams = new URLSearchParams(params);
  listParams.set("view", view);

  const [loans, counts, books, waitlist, canManage] = await Promise.all([
    bookLoansServerApi.listPage(listParams),
    bookLoansServerApi.getCounts(),
    bookLoansServerApi.listBooks(),
    bookLoansServerApi.listWaitlist(),
    auth().then((session) => sessionHas(session, "loans.manage")),
  ]);

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
