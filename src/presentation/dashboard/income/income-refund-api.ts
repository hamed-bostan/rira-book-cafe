import type { RefundFormInput } from "@/src/contracts/booking-money-schema";
import type { IncomeRefund } from "@/src/domain/entities/IncomeRefund";
import { apiPost } from "@/src/lib/api/client";

import { incomeRefundListResponseSchema } from "./income-refund-response-schema";

/** What a refund hands money back from: a suite stay, or one sign-up for an event. */
export type RefundTarget =
  { kind: "suiteBooking"; stayId: string } | { kind: "eventRegistration"; eventId: string; registrationId: string };

/** Typed client for refunds; each books its entries server-side and tells the guest. */
export const incomeRefundsApi = {
  /** Hand back up to what's been paid and not yet refunded. 400 (`amount`) for more. */
  create(target: RefundTarget, values: RefundFormInput): Promise<IncomeRefund[]> {
    const path =
      target.kind === "suiteBooking"
        ? `/admin/suite-bookings/${target.stayId}/refunds`
        : `/admin/events/${target.eventId}/registrations/${target.registrationId}/refunds`;
    return apiPost(path, values, incomeRefundListResponseSchema);
  },
};
