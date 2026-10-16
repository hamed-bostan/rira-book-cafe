import { auth } from "@/auth";
import { cafeDayOf, isCafeDay } from "@/src/domain/entities/CafeTime";
import { RESERVATION_STATUSES, type ReservationStatus } from "@/src/domain/entities/Reservation";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { sessionHas } from "@/src/lib/require-permission";
import { reservationsServerApi } from "@/src/presentation/dashboard/reservations/reservation-server-api";
import { ReservationsScreen } from "@/src/presentation/dashboard/reservations/ReservationsScreen";

// One cafe day's bookings are fetched over the REST API (BFF) during server render.
// The day (`?day=`, default today) and status filter live in the query string.
export const dynamic = "force-dynamic";

type DashboardReservationsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const STATUS_SET = new Set<string>(RESERVATION_STATUSES);

export default async function DashboardReservationsPage({ searchParams }: DashboardReservationsPageProps) {
  const params = toSearchParams(await searchParams);
  const today = cafeDayOf(new Date());
  const dayParam = params.get("day");
  const day = dayParam && isCafeDay(dayParam) ? dayParam : today;
  const statusParam = params.get("status");
  const status = statusParam && STATUS_SET.has(statusParam) ? (statusParam as ReservationStatus) : undefined;

  const [reservations, canManage] = await Promise.all([
    reservationsServerApi.listForDay(day, status),
    auth().then((session) => sessionHas(session, "reservations.manage")),
  ]);

  return (
    <ReservationsScreen
      reservations={reservations}
      day={day}
      today={today}
      isFiltered={status !== undefined}
      query={params.toString()}
      canManage={canManage}
    />
  );
}
