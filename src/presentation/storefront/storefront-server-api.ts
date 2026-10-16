import { profileResponseSchema, type ProfileWire } from "@/src/contracts/profile-schema";
import type { CafeEvent, EventRegistration } from "@/src/domain/entities/CafeEvent";
import type { Category } from "@/src/domain/entities/Category";
import type { Order } from "@/src/domain/entities/Order";
import type { Product } from "@/src/domain/entities/Product";
import type { Reservation } from "@/src/domain/entities/Reservation";
import { ApiError } from "@/src/lib/api/ApiError";
import { serverApiGet } from "@/src/lib/api/server-client";
import { categoryListResponseSchema } from "@/src/presentation/category/category-response-schema";
import {
  eventListResponseSchema,
  eventRegistrationListResponseSchema,
  eventResponseSchema,
} from "@/src/presentation/events/event-response-schema";
import { orderListResponseSchema, orderResponseSchema } from "@/src/presentation/orders/order-response-schema";
import { productListResponseSchema, productResponseSchema } from "@/src/presentation/product/product-response-schema";
import { reservationListResponseSchema } from "@/src/presentation/reservations/reservation-response-schema";

/** `null` for a 404, so a page can `notFound()`; everything else propagates to the error boundary. */
async function orNull<T>(read: Promise<T>): Promise<T | null> {
  try {
    return await read;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Server-side reads for the public site (BFF), fetched during server render in the
 * guest's language. Guest-owned reads forward the session cookie, so each
 * endpoint answers for the signed-in guest only.
 */
export const storefrontServerApi = {
  /** Active categories only — an inactive one is hidden from guests with its items. */
  async categories(): Promise<Category[]> {
    const all = await serverApiGet("/categories", categoryListResponseSchema);
    return all.filter((category) => category.isActive);
  },

  /** The published menu. */
  menu(): Promise<Product[]> {
    return serverApiGet("/products", productListResponseSchema);
  },

  featured(): Promise<Product[]> {
    return serverApiGet("/products", productListResponseSchema, { params: { featured: "true" } });
  },

  item(id: string): Promise<Product | null> {
    return orNull(serverApiGet(`/products/${id}`, productResponseSchema));
  },

  upcomingEvents(): Promise<CafeEvent[]> {
    return serverApiGet("/events", eventListResponseSchema);
  },

  event(id: string): Promise<CafeEvent | null> {
    return orNull(serverApiGet(`/events/${id}`, eventResponseSchema));
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

  myRegistrations(): Promise<EventRegistration[]> {
    return serverApiGet("/event-registrations", eventRegistrationListResponseSchema);
  },

  profile(): Promise<ProfileWire> {
    return serverApiGet("/profile", profileResponseSchema);
  },
};
