import { auth } from "@/auth";
import { cafeDayOf, isCafeDay, shiftCafeDay } from "@/src/domain/entities/CafeTime";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { sessionHas } from "@/src/lib/require-permission";
import { suiteBookingsServerApi } from "@/src/presentation/dashboard/suite-bookings/suite-booking-server-api";
import {
  SUITE_TABS,
  SuiteBookingsScreen,
  type SuiteTab,
} from "@/src/presentation/dashboard/suite-bookings/SuiteBookingsScreen";
import { PAST_LOOKBACK_DAYS, WINDOW_LEAD_DAYS } from "@/src/presentation/dashboard/suite-bookings/suiteCalendar";

// Stays are fetched over the REST API (BFF) during server render: everything that
// ends after the earlier of the calendar's first day and the Past tab's reach, so
// one read serves both. The calendar's start (`?from=`), the tab (`?tab=`) and the
// stay picked from the calendar (`?focus=`) live in the query string.
export const dynamic = "force-dynamic";

type DashboardSuitePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardSuitePage({ searchParams }: DashboardSuitePageProps) {
  const params = toSearchParams(await searchParams);
  const today = cafeDayOf(new Date());
  const fromParam = params.get("from");
  const windowStart = fromParam && isCafeDay(fromParam) ? fromParam : shiftCafeDay(today, -WINDOW_LEAD_DAYS);
  const tab: SuiteTab = SUITE_TABS.find((value) => value === params.get("tab")) ?? "upcoming";
  const pastFrom = shiftCafeDay(today, -PAST_LOOKBACK_DAYS);

  const [bookings, canManage] = await Promise.all([
    suiteBookingsServerApi.listFrom(windowStart < pastFrom ? windowStart : pastFrom),
    auth().then((session) => sessionHas(session, "reservations.manage")),
  ]);

  return (
    <SuiteBookingsScreen
      bookings={bookings}
      today={today}
      windowStart={windowStart}
      tab={tab}
      focusId={params.get("focus") ?? undefined}
      canManage={canManage}
    />
  );
}
