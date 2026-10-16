import type { AdminOrderFilters, AdminOrderSort, OrderStatusCounts } from "../../entities/AdminOrderFilters";
import type { Order } from "../../entities/Order";
import type { OrderStatusEvent } from "../../entities/OrderStatusEvent";
import type { Page, PageRequest } from "../../entities/Pagination";
import type { IOrderRepository } from "../../repositories/IOrderRepository";

/** One page of the dashboard order list. A cross-guest read — gate the caller to the dashboard. */
export class ListOrders {
  constructor(private readonly orderRepo: IOrderRepository) {}

  execute(filters: AdminOrderFilters, page: PageRequest<AdminOrderSort>): Promise<Page<Order>> {
    return this.orderRepo.listPage(filters, page);
  }
}

/** Orders per status, for the status tabs. */
export class GetOrderStatusCounts {
  constructor(private readonly orderRepo: IOrderRepository) {}

  execute(): Promise<OrderStatusCounts> {
    return this.orderRepo.countByStatus();
  }
}

/** One order by id, any owner — the dashboard's read. */
export class GetOrderById {
  constructor(private readonly orderRepo: IOrderRepository) {}

  execute(id: string): Promise<Order | null> {
    return this.orderRepo.getById(id);
  }
}

/** One of the guest's own orders; someone else's reads as `null` so ids can't be probed. */
export class GetOwnOrder {
  constructor(private readonly orderRepo: IOrderRepository) {}

  async execute(id: string, userId: string): Promise<Order | null> {
    const order = await this.orderRepo.getById(id);
    return order?.userId === userId ? order : null;
  }
}

/** The guest's own orders, newest first. */
export class ListOwnOrders {
  constructor(private readonly orderRepo: IOrderRepository) {}

  execute(userId: string): Promise<Order[]> {
    return this.orderRepo.listForUser(userId);
  }
}

/** An order's status history, oldest first. */
export class ListOrderStatusEvents {
  constructor(private readonly orderRepo: IOrderRepository) {}

  execute(orderId: string): Promise<OrderStatusEvent[]> {
    return this.orderRepo.listStatusEvents(orderId);
  }
}
