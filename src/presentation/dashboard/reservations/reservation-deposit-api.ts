import type { ReservationDepositInput } from "@/src/contracts/booking-money-schema";
import type { Reservation } from "@/src/domain/entities/Reservation";
import type { ReservationDepositSettlement } from "@/src/domain/entities/ReservationDeposit";
import { apiPatch, apiPost } from "@/src/lib/api/client";
import { reservationResponseSchema } from "@/src/presentation/reservations/reservation-response-schema";

/** Typed client for a table booking's deposit; each write books its entry server-side. */
export const reservationDepositsApi = {
  /** Take a deposit on a booking that's still on. 409 when it already has one, or is over. */
  create(reservationId: string, values: ReservationDepositInput): Promise<Reservation> {
    return apiPost(`/admin/reservations/${reservationId}/deposit`, values, reservationResponseSchema);
  },

  /** Hand the held deposit back, or keep it, once the booking is over. */
  update(reservationId: string, settle: ReservationDepositSettlement): Promise<Reservation> {
    return apiPatch(`/admin/reservations/${reservationId}/deposit`, { settle }, reservationResponseSchema);
  },
};
