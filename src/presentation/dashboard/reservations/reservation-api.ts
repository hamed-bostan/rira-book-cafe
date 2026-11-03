import type {
  ReservationDetailsInput,
  ReservationUpdateInput,
  StaffReservationInput,
} from "@/src/contracts/reservation-schema";
import type { Floor } from "@/src/domain/entities/FloorAvailability";
import type { Reservation } from "@/src/domain/entities/Reservation";
import { apiGet, apiPatch, apiPost } from "@/src/lib/api/client";
import { reservationResponseSchema } from "@/src/presentation/reservations/reservation-response-schema";

import { floorResponseSchema } from "./floor-response-schema";

/** Typed client for the dashboard's reservation mutations; components `router.refresh()` after. */
export const reservationsApi = {
  /** Book a phone or walk-in guest; with a table it's confirmed. 409 when the table was just taken. */
  create(values: StaffReservationInput): Promise<Reservation> {
    return apiPost("/admin/reservations", values, reservationResponseSchema);
  },

  /** Change status and/or table, or take back a Seat or Complete (`undo`). 409 for a refused transition or a table already held. */
  update(id: string, values: ReservationUpdateInput): Promise<Reservation> {
    return apiPatch(`/admin/reservations/${id}`, values, reservationResponseSchema);
  },

  /** Edit a booking's day, time, party, length, guest, note or table. 409 when the table is taken at the new time. */
  edit(id: string, values: ReservationDetailsInput): Promise<Reservation> {
    return apiPatch(`/admin/reservations/${id}/details`, values, reservationResponseSchema);
  },

  /** What holds the tables around another day — read when "Edit booking" moves a booking off the day on screen. */
  getFloor(day: string): Promise<Floor> {
    return apiGet("/admin/reservations/floor", floorResponseSchema, { params: { day } });
  },
};
