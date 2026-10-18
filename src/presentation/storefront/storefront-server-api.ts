import { cache } from "react";

import { profileResponseSchema, type ProfileWire } from "@/src/contracts/profile-schema";
import type { BookLoan } from "@/src/domain/entities/BookLoan";
import type { BookWaitlistEntry, BookWaitlistStatus } from "@/src/domain/entities/BookWaitlist";
import type { CafeEvent, EventRegistration } from "@/src/domain/entities/CafeEvent";
import type { Category } from "@/src/domain/entities/Category";
import type { GuestLoyaltyOverview } from "@/src/domain/entities/Loyalty";
import type { Notification } from "@/src/domain/entities/Notification";
import type { Order } from "@/src/domain/entities/Order";
import type { Product } from "@/src/domain/entities/Product";
import type { PublicReview, ReviewEligibility } from "@/src/domain/entities/ProductReview";
import type { Reservation } from "@/src/domain/entities/Reservation";
import type { SuiteBooking, SuiteBusyRange } from "@/src/domain/entities/SuiteBooking";
import { ApiError } from "@/src/lib/api/ApiError";
import { serverApiGet } from "@/src/lib/api/server-client";
import { CATALOG_TAGS } from "@/src/lib/cache-tags";
import { bookLoanListResponseSchema } from "@/src/presentation/book-loans/book-loan-response-schema";
import {
  bookWaitlistEntryListResponseSchema,
  bookWaitlistStatusResponseSchema,
} from "@/src/presentation/book-loans/book-waitlist-response-schema";
import { categoryListResponseSchema } from "@/src/presentation/category/category-response-schema";
import {
  eventListResponseSchema,
  eventRegistrationListResponseSchema,
  eventResponseSchema,
} from "@/src/presentation/events/event-response-schema";
import { guestLoyaltyOverviewResponseSchema } from "@/src/presentation/loyalty/loyalty-response-schema";
import {
  notificationListResponseSchema,
  unreadCountResponseSchema,
} from "@/src/presentation/notifications/notification-response-schema";
import { orderListResponseSchema, orderResponseSchema } from "@/src/presentation/orders/order-response-schema";
import { productListResponseSchema, productResponseSchema } from "@/src/presentation/product/product-response-schema";
import { reservationListResponseSchema } from "@/src/presentation/reservations/reservation-response-schema";
import {
  publicReviewListResponseSchema,
  reviewEligibilityResponseSchema,
} from "@/src/presentation/reviews/review-response-schema";
import {
  suiteBookingListResponseSchema,
  suiteBusyListResponseSchema,
} from "@/src/presentation/suite-bookings/suite-booking-response-schema";

/** `null` for a 404, so a page can `notFound()`; everything else propagates to the error boundary. */
async function orNull<T>(read: Promise<T>): Promise<T | null> {
  try {
    return await read;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

// The public catalog is the same for every guest, so it's served from Next's data
// cache (tagged, and expired by the write routes the moment it changes) rather than
// re-queried on every render. Guest-owned reads below stay uncached.
const PRODUCTS = { cache: { tags: [CATALOG_TAGS.products] } } as const;
const CATEGORIES = { cache: { tags: [CATALOG_TAGS.categories] } } as const;
const EVENTS = { cache: { tags: [CATALOG_TAGS.events] } } as const;

// Reads that both a page's `generateMetadata` and its body make. `serverApiGet` passes
// a timeout `signal`, which opts its fetch out of Next's request memoization, so these
// are memoized per request with React `cache` instead of hitting the API twice.
const readCategories = cache(async (): Promise<Category[]> => {
  const all = await serverApiGet("/categories", categoryListResponseSchema, CATEGORIES);
  return all.filter((category) => category.isActive);
});
const readItem = cache((id: string): Promise<Product | null> =>
  orNull(serverApiGet(`/products/${id}`, productResponseSchema, PRODUCTS)),
);
const readEvent = cache((id: string): Promise<CafeEvent | null> =>
  orNull(serverApiGet(`/events/${id}`, eventResponseSchema, EVENTS)),
);

/**
 * Server-side reads for the public site (BFF), fetched during server render in the
 * guest's language. Guest-owned reads forward the session cookie, so each
 * endpoint answers for the signed-in guest only.
 */
export const storefrontServerApi = {
  /** Active categories only — an inactive one is hidden from guests with its items. */
  categories(): Promise<Category[]> {
    return readCategories();
  },

  /** The published menu. */
  menu(): Promise<Product[]> {
    return serverApiGet("/products", productListResponseSchema, PRODUCTS);
  },

  featured(): Promise<Product[]> {
    return serverApiGet("/products", productListResponseSchema, { ...PRODUCTS, params: { featured: "true" } });
  },

  item(id: string): Promise<Product | null> {
    return readItem(id);
  },

  /** An item's approved reviews, newest first. */
  productReviews(productId: string): Promise<PublicReview[]> {
    return serverApiGet(`/products/${productId}/reviews`, publicReviewListResponseSchema);
  },

  /** Whether the signed-in guest can review the item, and their review if they wrote one. */
  myReviewEligibility(productId: string): Promise<ReviewEligibility> {
    return serverApiGet(`/products/${productId}/reviews/mine`, reviewEligibilityResponseSchema);
  },

  upcomingEvents(): Promise<CafeEvent[]> {
    return serverApiGet("/events", eventListResponseSchema, EVENTS);
  },

  event(id: string): Promise<CafeEvent | null> {
    return readEvent(id);
  },

  myOrders(): Promise<Order[]> {
    return serverApiGet("/orders", orderListResponseSchema);
  },

  myOrder(id: string): Promise<Order | null> {
    return orNull(serverApiGet(`/orders/${id}`, orderResponseSchema));
  },

  myReservations(): Promise<Reservation[]> {
    return serverApiGet("/reservations", reservationListResponseSchema);
  },

  mySuiteBookings(): Promise<SuiteBooking[]> {
    return serverApiGet("/suite-bookings", suiteBookingListResponseSchema);
  },

  /** The nights the suite is already held, from today on — no names. */
  suiteAvailability(): Promise<SuiteBusyRange[]> {
    return serverApiGet("/suite-bookings/availability", suiteBusyListResponseSchema);
  },

  /** Books the guest has borrowed (loans staff linked to their phone). */
  myBookLoans(): Promise<BookLoan[]> {
    return serverApiGet("/book-loans", bookLoanListResponseSchema);
  },

  /** A book's waitlist: copies out, line length, and the guest's place in it. */
  bookWaitlist(productId: string): Promise<BookWaitlistStatus> {
    return serverApiGet(`/products/${productId}/waitlist`, bookWaitlistStatusResponseSchema);
  },

  /** The books the guest is (or was) in line for. */
  myBookWaitlist(): Promise<BookWaitlistEntry[]> {
    return serverApiGet("/book-waitlist", bookWaitlistEntryListResponseSchema);
  },

  myRegistrations(): Promise<EventRegistration[]> {
    return serverApiGet("/event-registrations", eventRegistrationListResponseSchema);
  },

  /** The guest's notifications, newest first (due loan reminders included). */
  notifications(): Promise<Notification[]> {
    return serverApiGet("/notifications", notificationListResponseSchema);
  },

  /** How many notifications the guest hasn't read — the bell's badge. */
  async unreadNotificationCount(): Promise<number> {
    const { count } = await serverApiGet("/notifications/unread-count", unreadCountResponseSchema);
    return count;
  },

  /** The guest's loyalty points: balance, recent movements and the club's rules. */
  loyalty(): Promise<GuestLoyaltyOverview> {
    return serverApiGet("/loyalty", guestLoyaltyOverviewResponseSchema);
  },

  profile(): Promise<ProfileWire> {
    return serverApiGet("/profile", profileResponseSchema);
  },
};
