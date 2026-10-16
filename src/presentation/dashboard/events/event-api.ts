import type { EventFormInput } from "@/src/contracts/event-schema";
import type { CafeEvent } from "@/src/domain/entities/CafeEvent";
import { apiDelete, apiPost, apiPut } from "@/src/lib/api/client";
import { eventResponseSchema } from "@/src/presentation/events/event-response-schema";

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

  /** Cancel a guest's sign-up; the caller refreshes to show the freed seats. */
  cancelRegistration(eventId: string, registrationId: string): Promise<void> {
    return apiDelete(`/admin/events/${eventId}/registrations/${registrationId}`);
  },
};
