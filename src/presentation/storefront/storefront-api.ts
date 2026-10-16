import type { EventRegistrationInput } from "@/src/contracts/event-schema";
import type { PlaceOrderInput } from "@/src/contracts/order-schema";
import { profileResponseSchema, type ProfileUpdateInput, type ProfileWire } from "@/src/contracts/profile-schema";
import type { RequestReservationInput } from "@/src/contracts/reservation-schema";
import type { EventRegistration } from "@/src/domain/entities/CafeEvent";
import type { Order } from "@/src/domain/entities/Order";
import type { Reservation } from "@/src/domain/entities/Reservation";
import { apiDelete, apiPost, apiPut } from "@/src/lib/api/client";
import { eventRegistrationResponseSchema } from "@/src/presentation/events/event-response-schema";
import { orderResponseSchema } from "@/src/presentation/orders/order-response-schema";
import { paymentSessionResponseSchema, type PaymentSessionResponse } from "@/src/presentation/orders/payment-response-schema";
import { reservationResponseSchema } from "@/src/presentation/reservations/reservation-response-schema";

/**
 * Typed client for the guest's own actions on the public site. Each rejects with
 * an `ApiError` — `401` when signed out, `409` when the state refuses (sold out,
 * event full, too late to cancel). Components `router.refresh()` or navigate after.
 */
export const storefrontApi = {
  placeOrder(input: PlaceOrderInput): Promise<Order> {
    return apiPost("/orders", input, orderResponseSchema);
  },

  cancelOrder(id: string): Promise<Order> {
    return apiPost(`/orders/${id}/cancel`, {}, orderResponseSchema);
  },

  /** Opens an online payment; send the guest to `redirectUrl`. 409 `NOT_PAYABLE` once paid or cancelled. */
  payOrder(id: string): Promise<PaymentSessionResponse> {
    return apiPost(`/orders/${id}/pay`, {}, paymentSessionResponseSchema);
  },

  requestReservation(input: RequestReservationInput): Promise<Reservation> {
    return apiPost("/reservations", input, reservationResponseSchema);
  },

  cancelReservation(id: string): Promise<Reservation> {
    return apiPost(`/reservations/${id}/cancel`, {}, reservationResponseSchema);
  },

  registerForEvent(eventId: string, input: EventRegistrationInput): Promise<EventRegistration> {
    return apiPost(`/events/${eventId}/registrations`, input, eventRegistrationResponseSchema);
  },

  cancelRegistration(registrationId: string): Promise<void> {
    return apiDelete(`/event-registrations/${registrationId}`);
  },

  updateProfile(input: ProfileUpdateInput): Promise<ProfileWire> {
    return apiPut("/profile", input, profileResponseSchema);
  },
};
