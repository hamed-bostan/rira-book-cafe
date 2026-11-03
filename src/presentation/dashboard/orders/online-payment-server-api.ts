import type { OrderPaymentAttempt } from "@/src/domain/entities/PaymentAttempt";
import { serverApiGet } from "@/src/lib/api/server-client";

import { orderPaymentAttemptListResponseSchema } from "./online-payment-response-schema";

/**
 * Server-side reads of online payments no order took (BFF), fetched during server
 * render. Marking one given back goes through the browser `onlinePaymentsApi`,
 * which then `router.refresh()`es to re-run these.
 */
export const onlinePaymentsServerApi = {
  /** Every payment still to give back, oldest first — the Orders list's warning. */
  listUnapplied(): Promise<OrderPaymentAttempt[]> {
    return serverApiGet("/admin/online-payments/unapplied", orderPaymentAttemptListResponseSchema);
  },

  /** One order's payments it didn't take, still to give back or given back. */
  listForOrder(orderId: string): Promise<OrderPaymentAttempt[]> {
    return serverApiGet(`/admin/orders/${orderId}/online-payments`, orderPaymentAttemptListResponseSchema);
  },
};
