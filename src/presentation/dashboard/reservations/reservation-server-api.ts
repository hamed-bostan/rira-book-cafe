import type { Reservation, ReservationStatus } from "@/src/domain/entities/Reservation";
import { serverApiGet } from "@/src/lib/api/server-client";
import { reservationListResponseSchema } from "@/src/presentation/reservations/reservation-response-schema";

/** Server-side reservation reads for the dashboard (BFF), fetched during server render. */
export const reservationsServerApi = {
  /** One cafe day's reservations, in start order. */
  listForDay(day: string, status?: ReservationStatus): Promise<Reservation[]> {
    return serverApiGet("/admin/reservations", reservationListResponseSchema, {
      params: status ? { day, status } : { day },
    });
  },
};
