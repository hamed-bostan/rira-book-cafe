import { orderNoteListResponseSchema } from "@/src/contracts/order-note-schema";
import type { OrderStatusCounts } from "@/src/domain/entities/AdminOrderFilters";
import type { Order } from "@/src/domain/entities/Order";
import type { OrderNote } from "@/src/domain/entities/OrderNote";
import type { OrderStatusEvent } from "@/src/domain/entities/OrderStatusEvent";
import type { Page } from "@/src/domain/entities/Pagination";
import { ApiError } from "@/src/lib/api/ApiError";
import { pageResponseSchema } from "@/src/lib/api/page-response-schema";
import { serverApiGet } from "@/src/lib/api/server-client";
import {
  orderResponseSchema,
  orderStatusCountsResponseSchema,
  orderStatusEventListResponseSchema,
} from "@/src/presentation/orders/order-response-schema";

const orderPageResponseSchema = pageResponseSchema(orderResponseSchema);

/**
 * Server-side order reads for the dashboard (BFF), fetched during server render.
 * Mutations go through the browser `ordersApi`, which then `router.refresh()`es
 * to re-run these.
 */
export const ordersServerApi = {
  /** One page of the list, with the filters/paging the page's query string carries (forwarded verbatim). */
  listPage(params: URLSearchParams): Promise<Page<Order>> {
    return serverApiGet("/admin/orders", orderPageResponseSchema, { params: Object.fromEntries(params) });
  },

  counts(): Promise<OrderStatusCounts> {
    return serverApiGet("/admin/orders/counts", orderStatusCountsResponseSchema);
  },

  /** One order; `null` on 404 so the page can `notFound()`. */
  async getById(id: string): Promise<Order | null> {
    try {
      return await serverApiGet(`/admin/orders/${id}`, orderResponseSchema);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },

  listStatusEvents(id: string): Promise<OrderStatusEvent[]> {
    return serverApiGet(`/admin/orders/${id}/status`, orderStatusEventListResponseSchema);
  },

  listNotes(id: string): Promise<OrderNote[]> {
    return serverApiGet(`/admin/orders/${id}/notes`, orderNoteListResponseSchema);
  },
};
