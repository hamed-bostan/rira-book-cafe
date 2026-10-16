import type { OrderNoteInput } from "@/src/contracts/order-note-schema";
import { orderNoteResponseSchema } from "@/src/contracts/order-note-schema";
import type { OrderPaymentInput, OrderStatusChangeInput } from "@/src/contracts/order-schema";
import type { Order } from "@/src/domain/entities/Order";
import type { OrderNote } from "@/src/domain/entities/OrderNote";
import { apiPatch, apiPost } from "@/src/lib/api/client";
import { orderResponseSchema } from "@/src/presentation/orders/order-response-schema";

/**
 * Typed client for the dashboard's order *mutations*. Components call these, then
 * `router.refresh()` so the server render shows the result. Reads are server-side
 * (see `ordersServerApi`).
 */
export const ordersApi = {
  /** Move the order along the workflow (or cancel it). 409 if someone else moved it first. */
  changeStatus(id: string, values: OrderStatusChangeInput): Promise<Order> {
    return apiPatch(`/admin/orders/${id}/status`, values, orderResponseSchema);
  },

  setPayment(id: string, values: OrderPaymentInput): Promise<Order> {
    return apiPatch(`/admin/orders/${id}/payment`, values, orderResponseSchema);
  },

  addNote(id: string, values: OrderNoteInput): Promise<OrderNote> {
    return apiPost(`/admin/orders/${id}/notes`, values, orderNoteResponseSchema);
  },
};
