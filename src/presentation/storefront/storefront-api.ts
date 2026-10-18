import type { EventRegistrationInput } from "@/src/contracts/event-schema";
import type { PlaceOrderInput, QuoteOrderInput } from "@/src/contracts/order-schema";
import { profileResponseSchema, type ProfileUpdateInput, type ProfileWire } from "@/src/contracts/profile-schema";
import type { RequestReservationInput } from "@/src/contracts/reservation-schema";
import type { SubmitReviewInput } from "@/src/contracts/review-schema";
import type { RequestSuiteBookingInput } from "@/src/contracts/suite-booking-schema";
import type { BookWaitlistEntry } from "@/src/domain/entities/BookWaitlist";
import type { EventRegistration } from "@/src/domain/entities/CafeEvent";
import type { OrderQuote } from "@/src/domain/entities/Checkout";
import type { Order } from "@/src/domain/entities/Order";
import type { ProductReview } from "@/src/domain/entities/ProductReview";
import type { Reservation } from "@/src/domain/entities/Reservation";
import type { SuiteBooking } from "@/src/domain/entities/SuiteBooking";
import { apiDelete, apiPost, apiPut } from "@/src/lib/api/client";
import { bookWaitlistEntryResponseSchema } from "@/src/presentation/book-loans/book-waitlist-response-schema";
import { eventRegistrationResponseSchema } from "@/src/presentation/events/event-response-schema";
import { orderQuoteResponseSchema } from "@/src/presentation/loyalty/loyalty-response-schema";
import { orderResponseSchema } from "@/src/presentation/orders/order-response-schema";
import {
  paymentSessionResponseSchema,
  type PaymentSessionResponse,
} from "@/src/presentation/orders/payment-response-schema";
import { reservationResponseSchema } from "@/src/presentation/reservations/reservation-response-schema";
import { reviewResponseSchema } from "@/src/presentation/reviews/review-response-schema";
import { suiteBookingResponseSchema } from "@/src/presentation/suite-bookings/suite-booking-response-schema";

/**
 * Typed client for the guest's own actions on the public site. Each rejects with
 * an `ApiError` — `401` when signed out, `409` when the state refuses (sold out,
 * event full, too late to cancel). Components `router.refresh()` or navigate after.
 */
export const storefrontApi = {
  /** What the basket would cost with a promo code and/or points. 409 with the reason a code can't be used. */
  quoteOrder(input: QuoteOrderInput): Promise<OrderQuote> {
    return apiPost("/orders/quote", input, orderQuoteResponseSchema);
  },

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

  requestSuiteBooking(input: RequestSuiteBookingInput): Promise<SuiteBooking> {
    return apiPost("/suite-bookings", input, suiteBookingResponseSchema);
  },

  cancelSuiteBooking(id: string): Promise<SuiteBooking> {
    return apiPost(`/suite-bookings/${id}/cancel`, {}, suiteBookingResponseSchema);
  },

  registerForEvent(eventId: string, input: EventRegistrationInput): Promise<EventRegistration> {
    return apiPost(`/events/${eventId}/registrations`, input, eventRegistrationResponseSchema);
  },

  cancelRegistration(registrationId: string): Promise<void> {
    return apiDelete(`/event-registrations/${registrationId}`);
  },

  /** Write or rewrite the guest's review of an item; it waits for staff. 409 `NOT_PURCHASED` if they haven't had it. */
  submitReview(productId: string, input: SubmitReviewInput): Promise<ProductReview> {
    return apiPut(`/products/${productId}/reviews/mine`, input, reviewResponseSchema);
  },

  /** Get in line for a book that's out. 409 `ALREADY_WAITING` / `BOOK_ON_SHELF`. */
  joinBookWaitlist(productId: string): Promise<BookWaitlistEntry> {
    return apiPost(`/products/${productId}/waitlist`, {}, bookWaitlistEntryResponseSchema);
  },

  leaveBookWaitlist(entryId: string): Promise<void> {
    return apiDelete(`/book-waitlist/${entryId}`);
  },

  /** Everything in the guest's notifications is now read. */
  markNotificationsRead(): Promise<void> {
    return apiPost("/notifications/read");
  },

  updateProfile(input: ProfileUpdateInput): Promise<ProfileWire> {
    return apiPut("/profile", input, profileResponseSchema);
  },
};
