import type { Floor } from "@/src/domain/entities/FloorAvailability";
import type { Reservation, ReservationStatus } from "@/src/domain/entities/Reservation";
import { serverApiGet } from "@/src/lib/api/server-client";
import { reservationListResponseSchema } from "@/src/presentation/reservations/reservation-response-schema";

import { floorResponseSchema } from "./floor-response-schema";

/** Server-side reservation reads for the dashboard (BFF), fetched during server render. */
export const reservationsServerApi = {
  /** One cafe day's reservations, in start order. */
  listForDay(day: string, status?: ReservationStatus): Promise<Reservation[]> {
    return serverApiGet("/admin/reservations", reservationListResponseSchema, {
      params: status ? { day, status } : { day },
    });
  },

  /** Every reservation from `from` (cafe day) on, in start order — e.g. all the requests still waiting. */
  listFrom(from: string, status?: ReservationStatus): Promise<Reservation[]> {
    return serverApiGet("/admin/reservations", reservationListResponseSchema, {
      params: status ? { from, status } : { from },
    });
  },

  /** What holds the tables around one cafe day, for the table pickers — a day either side included. */
  getFloor(day: string): Promise<Floor> {
    return serverApiGet("/admin/reservations/floor", floorResponseSchema, { params: { day } });
  },
};
