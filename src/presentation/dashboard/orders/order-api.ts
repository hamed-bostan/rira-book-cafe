import type { OrderBulkAction } from "@/src/contracts/bulk-action-schema";
import type { OrderNoteInput } from "@/src/contracts/order-note-schema";
import type {
  CounterOrderFormInput,
  OrderItemServedInput,
  OrderPaymentInput,
  OrderRefundInput,
  OrderStatusChangeInput,
  OrderWriteOffInput,
} from "@/src/contracts/order-schema";
import type { Order } from "@/src/domain/entities/Order";
import type { OrderNote } from "@/src/domain/entities/OrderNote";
import { apiPatch, apiPost } from "@/src/lib/api/client";
import { bulkResultSchema, type BulkResult } from "@/src/presentation/dashboard/bulk/bulk-result-response-schema";
import { orderNoteResponseSchema } from "@/src/presentation/dashboard/orders/order-note-response-schema";
import { orderRefundResultResponseSchema, orderResponseSchema } from "@/src/presentation/orders/order-response-schema";

/**
 * Typed client for the dashboard's order *mutations*. Components call these, then
 * `router.refresh()` so the server render shows the result. Reads are server-side
 * (see `ordersServerApi`).
 */
export const ordersApi = {
  /** Ring up a sale at the counter. 409 when an item just sold out. */
  createCounterSale(values: CounterOrderFormInput): Promise<Order> {
    return apiPost("/admin/orders", values, orderResponseSchema);
  },

  /** Hand money back on a completed order. 409 if someone refunded it first. */
  async refund(id: string, values: OrderRefundInput): Promise<Order> {
    const { order } = await apiPost(`/admin/orders/${id}/refunds`, values, orderRefundResultResponseSchema);
    return order;
  },

  /** Write off a served order nobody paid for. 409 if it was paid (or written off) meanwhile. */
  writeOff(id: string, values: OrderWriteOffInput): Promise<Order> {
    return apiPost(`/admin/orders/${id}/write-off`, values, orderResponseSchema);
  },

  /** Move the order along the workflow (or cancel it). 409 if someone else moved it first. */
  changeStatus(id: string, values: OrderStatusChangeInput): Promise<Order> {
    return apiPatch(`/admin/orders/${id}/status`, values, orderResponseSchema);
  },

  setPayment(id: string, values: OrderPaymentInput): Promise<Order> {
    return apiPatch(`/admin/orders/${id}/payment`, values, orderResponseSchema);
  },

  /** Tick one line off as served, or take the tick back. 409 once the order is finished. */
  setItemServed(id: string, itemId: string, values: OrderItemServedInput): Promise<Order> {
    return apiPatch(`/admin/orders/${id}/items/${itemId}`, values, orderResponseSchema);
  },

  addNote(id: string, values: OrderNoteInput): Promise<OrderNote> {
    return apiPost(`/admin/orders/${id}/notes`, values, orderNoteResponseSchema);
  },

  /** Apply one action to a selection; answers how many orders it actually changed. */
  bulkUpdate(ids: readonly string[], action: OrderBulkAction): Promise<BulkResult> {
    return apiPatch("/admin/orders/bulk", { ids, action }, bulkResultSchema);
  },
};
