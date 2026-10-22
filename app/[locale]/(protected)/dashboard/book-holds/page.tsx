import { auth } from "@/auth";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { sessionHas } from "@/src/lib/require-permission";
import { BookHoldsScreen, HOLD_TABS, type HoldTab } from "@/src/presentation/dashboard/book-holds/BookHoldsScreen";
import { bookLoansServerApi } from "@/src/presentation/dashboard/book-loans/book-loan-server-api";

// The lines for books that are out, the books' copies, and the loans still out
// are fetched over the REST API (BFF) during server render. The tab (`?tab=`,
// default open) lives in the query string; both tabs are read so each shows its count.
export const dynamic = "force-dynamic";

type DashboardBookHoldsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardBookHoldsPage({ searchParams }: DashboardBookHoldsPageProps) {
  const params = toSearchParams(await searchParams);
  const tab: HoldTab = HOLD_TABS.find((value) => value === params.get("tab")) ?? "open";

  const [open, closed, books, openLoans, canManage] = await Promise.all([
    bookLoansServerApi.listWaitlist(),
    bookLoansServerApi.listClosedWaitlist(),
    bookLoansServerApi.listBooks(),
    bookLoansServerApi.list("open"),
    auth().then((session) => sessionHas(session, "loans.manage")),
  ]);

  return (
    <BookHoldsScreen
      open={open}
      closed={closed}
      books={books}
      openLoans={openLoans}
      tab={tab}
      now={new Date().toISOString()}
      canManage={canManage}
    />
  );
}
