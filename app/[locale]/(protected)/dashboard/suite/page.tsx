import { auth } from "@/auth";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { SUITE_BOOKING_STATUSES, type SuiteBookingStatus } from "@/src/domain/entities/SuiteBooking";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { sessionHas } from "@/src/lib/require-permission";
import { suiteBookingsServerApi } from "@/src/presentation/dashboard/suite-bookings/suite-booking-server-api";
import { SuiteBookingsScreen } from "@/src/presentation/dashboard/suite-bookings/SuiteBookingsScreen";

// Stays from today on are fetched over the REST API (BFF) during server render.
// The status filter lives in the query string.
export const dynamic = "force-dynamic";

type DashboardSuitePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const STATUS_SET = new Set<string>(SUITE_BOOKING_STATUSES);

export default async function DashboardSuitePage({ searchParams }: DashboardSuitePageProps) {
  const params = toSearchParams(await searchParams);
  const statusParam = params.get("status");
  const status = statusParam && STATUS_SET.has(statusParam) ? (statusParam as SuiteBookingStatus) : undefined;

  const [bookings, canManage] = await Promise.all([
    suiteBookingsServerApi.listFrom(cafeDayOf(new Date()), status),
    auth().then((session) => sessionHas(session, "reservations.manage")),
  ]);

  return <SuiteBookingsScreen bookings={bookings} isFiltered={status !== undefined} canManage={canManage} />;
}
