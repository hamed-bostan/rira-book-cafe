import { auth } from "@/auth";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { BOOK_LOAN_VIEWS, type BookLoanView } from "@/src/domain/repositories/IBookLoanRepository";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { sessionHas } from "@/src/lib/require-permission";
import { bookLoansServerApi } from "@/src/presentation/dashboard/book-loans/book-loan-server-api";
import { BookLoansScreen } from "@/src/presentation/dashboard/book-loans/BookLoansScreen";

// The lending book is fetched over the REST API (BFF) during server render. The
// view (`?view=`, default open) and search (`?q=`) live in the query string.
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

  const [loans, books, waitlist, canManage] = await Promise.all([
    bookLoansServerApi.list(view, q),
    bookLoansServerApi.listBooks(),
    bookLoansServerApi.listWaitlist(),
    auth().then((session) => sessionHas(session, "loans.manage")),
  ]);

  const now = new Date();
  return (
    <BookLoansScreen
      loans={loans}
      books={books}
      waitlist={waitlist}
      view={view}
      isSearching={q !== undefined}
      now={now.toISOString()}
      today={cafeDayOf(now)}
      canManage={canManage}
    />
  );
}
