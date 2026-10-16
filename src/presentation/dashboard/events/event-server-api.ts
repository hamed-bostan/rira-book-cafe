import type { CafeEvent, EventRegistration } from "@/src/domain/entities/CafeEvent";
import { ApiError } from "@/src/lib/api/ApiError";
import { serverApiGet } from "@/src/lib/api/server-client";
import {
  eventListResponseSchema,
  eventRegistrationListResponseSchema,
  eventResponseSchema,
} from "@/src/presentation/events/event-response-schema";

/** Server-side event reads for the dashboard (BFF), fetched during server render. */
export const eventsServerApi = {
  /** Every event in any state, newest start first. */
  listAll(): Promise<CafeEvent[]> {
    return serverApiGet("/admin/events", eventListResponseSchema);
  },

  /** One event in any state; `null` on 404 so the page can `notFound()`. */
  async getById(id: string): Promise<CafeEvent | null> {
    try {
      return await serverApiGet(`/admin/events/${id}`, eventResponseSchema);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },

  listRegistrations(id: string): Promise<EventRegistration[]> {
    return serverApiGet(`/admin/events/${id}/registrations`, eventRegistrationListResponseSchema);
  },
};
