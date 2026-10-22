import type { EventFormInput, EventTablesInput } from "@/src/contracts/event-schema";
import type { CafeEvent, EventTableOption } from "@/src/domain/entities/CafeEvent";
import { apiDelete, apiGet, apiPost, apiPut } from "@/src/lib/api/client";
import {
  eventResponseSchema,
  eventTableOptionListResponseSchema,
} from "@/src/presentation/events/event-response-schema";

/**
 * Typed client for the dashboard's event mutations. The wire payload is the
 * form's input shape; the route's `eventFormSchema` coerces it. Components
 * navigate or `router.refresh()` after.
 */
export const eventsApi = {
  create(values: EventFormInput): Promise<CafeEvent> {
    return apiPost("/events", values, eventResponseSchema);
  },

  update(id: string, values: EventFormInput): Promise<CafeEvent> {
    return apiPut(`/events/${id}`, values, eventResponseSchema);
  },

  /** 409 while guests are still registered. */
  remove(id: string): Promise<void> {
    return apiDelete(`/events/${id}`);
  },

  /** The floor for the "Hold tables" picker, read fresh when it opens — bookings move all day. */
  listTables(id: string): Promise<EventTableOption[]> {
    return apiGet(`/admin/events/${id}/tables`, eventTableOptionListResponseSchema);
  },

  /** Replace the tables the event holds; 409 `TABLE_TAKEN` when one was just booked. */
  holdTables(id: string, values: EventTablesInput): Promise<CafeEvent> {
    return apiPut(`/admin/events/${id}/tables`, values, eventResponseSchema);
  },

  /** Cancel a guest's sign-up; the caller refreshes to show the freed seats. */
  cancelRegistration(eventId: string, registrationId: string): Promise<void> {
    return apiDelete(`/admin/events/${eventId}/registrations/${registrationId}`);
  },
};
