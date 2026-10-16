import type { ReservationUpdateInput } from "@/src/contracts/reservation-schema";
import type { Reservation } from "@/src/domain/entities/Reservation";
import { apiPatch } from "@/src/lib/api/client";
import { reservationResponseSchema } from "@/src/presentation/reservations/reservation-response-schema";

/** Typed client for the dashboard's reservation mutations; components `router.refresh()` after. */
export const reservationsApi = {
  /** Change status and/or table. 409 for a refused transition or a table already held. */
  update(id: string, values: ReservationUpdateInput): Promise<Reservation> {
    return apiPatch(`/admin/reservations/${id}`, values, reservationResponseSchema);
  },
};
