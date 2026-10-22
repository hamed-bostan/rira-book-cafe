import { auth } from "@/auth";
import { cafeDayOf, cafeDayRange, isCafeDay } from "@/src/domain/entities/CafeTime";
import { RESERVATION_STATUSES, type ReservationStatus } from "@/src/domain/entities/Reservation";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { sessionHas } from "@/src/lib/require-permission";
import { eventsServerApi } from "@/src/presentation/dashboard/events/event-server-api";
import { reservationsServerApi } from "@/src/presentation/dashboard/reservations/reservation-server-api";
import { ReservationsScreen } from "@/src/presentation/dashboard/reservations/ReservationsScreen";

// One cafe day's bookings, and the events running that day, are fetched over the
// REST API (BFF) during server render. The day (`?day=`, default today) and the
// status tab (`?status=`) live in the query string; the whole day is always
// fetched so every tab can show its count.
export const dynamic = "force-dynamic";

type DashboardReservationsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const STATUS_SET = new Set<string>(RESERVATION_STATUSES);

export default async function DashboardReservationsPage({ searchParams }: DashboardReservationsPageProps) {
  const params = toSearchParams(await searchParams);
  const now = new Date();
  const today = cafeDayOf(now);
  const dayParam = params.get("day");
  const day = dayParam && isCafeDay(dayParam) ? dayParam : today;
  const statusParam = params.get("status");
  const status = statusParam && STATUS_SET.has(statusParam) ? (statusParam as ReservationStatus) : undefined;

  const { from, to } = cafeDayRange(day);
  const [reservations, events, canManage] = await Promise.all([
    reservationsServerApi.listForDay(day),
    eventsServerApi
      .listAll()
      .then((all) =>
        all
          .filter((event) => new Date(event.startsAt) < to && new Date(event.endsAt) > from)
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      ),
    auth().then((session) => sessionHas(session, "reservations.manage")),
  ]);

  return (
    <ReservationsScreen
      reservations={reservations}
      events={events}
      day={day}
      today={today}
      status={status}
      now={now.toISOString()}
      canManage={canManage}
    />
  );
}
