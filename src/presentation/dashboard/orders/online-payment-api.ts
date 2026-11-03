import type { OnlinePaymentUpdateInput } from "@/src/contracts/payment-schema";
import type { OrderPaymentAttempt } from "@/src/domain/entities/PaymentAttempt";
import { apiPatch } from "@/src/lib/api/client";

import { orderPaymentAttemptResponseSchema } from "./online-payment-response-schema";

/**
 * Typed client for marking an online payment no order took as given back. Components
 * call it, then `router.refresh()`; reads are server-side (`onlinePaymentsServerApi`).
 */
export const onlinePaymentsApi = {
  /** Mark it given back from the gateway's panel. 409 if someone marked it first. */
  update(id: string, values: OnlinePaymentUpdateInput): Promise<OrderPaymentAttempt> {
    return apiPatch(`/admin/online-payments/${id}`, values, orderPaymentAttemptResponseSchema);
  },
};
