import { auth } from "@/auth";
import { cafeDayOf, cafeDayRange, isCafeDay } from "@/src/domain/entities/CafeTime";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { sessionHas } from "@/src/lib/require-permission";
import { eventsServerApi } from "@/src/presentation/dashboard/events/event-server-api";
import { reservationsServerApi } from "@/src/presentation/dashboard/reservations/reservation-server-api";
import { ReservationsScreen } from "@/src/presentation/dashboard/reservations/ReservationsScreen";
import { RESERVATION_TABS, type ReservationTab } from "@/src/presentation/dashboard/reservations/reservationTabs";

// One cafe day's bookings, and the events running that day, are fetched over the
// REST API (BFF) during server render — with every request from today on, so
// those waiting on other days show too, and the floor around the day for the
// table pickers (a booking late the night before still holds its table). The day
// (`?day=`, default today) and the status tab (`?status=`) live in the query
// string; the whole day is always fetched so every tab can show its count.
export const dynamic = "force-dynamic";

type DashboardReservationsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const STATUS_SET = new Set<string>(RESERVATION_TABS);

export default async function DashboardReservationsPage({ searchParams }: DashboardReservationsPageProps) {
  const params = toSearchParams(await searchParams);
  const now = new Date();
  const today = cafeDayOf(now);
  const dayParam = params.get("day");
  const day = dayParam && isCafeDay(dayParam) ? dayParam : today;
  const statusParam = params.get("status");
  const status = statusParam && STATUS_SET.has(statusParam) ? (statusParam as ReservationTab) : undefined;

  const { from, to } = cafeDayRange(day);
  const [reservations, requests, floor, events, session] = await Promise.all([
    reservationsServerApi.listForDay(day),
    reservationsServerApi.listFrom(today, "requested"),
    reservationsServerApi.getFloor(day),
    eventsServerApi
      .listAll()
      .then((all) =>
        all
          .filter((event) => new Date(event.startsAt) < to && new Date(event.endsAt) > from)
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      ),
    auth(),
  ]);
  const [canManage, canManageEvents, canKeepDeposits] = await Promise.all([
    sessionHas(session, "reservations.manage"),
    sessionHas(session, "events.manage"),
    // Keeping a table's deposit books it as income, so it follows the books' permission.
    sessionHas(session, "accounting.write"),
  ]);

  return (
    <ReservationsScreen
      reservations={reservations}
      otherDayRequests={requests.filter((request) => cafeDayOf(new Date(request.startsAt)) !== day)}
      floor={floor}
      events={events}
      day={day}
      today={today}
      status={status}
      now={now.toISOString()}
      canManage={canManage}
      canManageEvents={canManageEvents}
      canKeepDeposits={canKeepDeposits}
    />
  );
}
