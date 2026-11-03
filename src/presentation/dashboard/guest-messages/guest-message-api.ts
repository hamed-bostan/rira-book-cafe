import type { GuestMessageFormInput } from "@/src/contracts/guest-message-schema";
import type { Notification } from "@/src/domain/entities/Notification";
import { apiPost } from "@/src/lib/api/client";
import { notificationResponseSchema } from "@/src/presentation/notifications/notification-response-schema";

/** Typed client for staff writing to a guest. The caller `router.refresh()`es after. */
export const guestMessagesApi = {
  /**
   * Send it to the guest's messages on the site. 409 `GUEST_CHANGED` when the phone
   * isn't the one on what it's about any more; 404 when that's gone.
   */
  create(values: GuestMessageFormInput): Promise<Notification> {
    return apiPost("/admin/guest-messages", values, notificationResponseSchema);
  },
};
