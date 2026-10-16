import type { OrderNote } from "@/src/domain/entities/OrderNote";
import type { IOrderNoteRepository, NewOrderNote } from "@/src/domain/repositories/IOrderNoteRepository";
import { prisma } from "@/src/infrastructure/prisma/client";

/**
 * Order notes backed by PostgreSQL via Prisma. Server-side only (it opens a DB
 * connection), bound through the container — never imported by client code.
 *
 * No `update`, no `delete`, and no transaction: a note is a single insert that
 * changes nothing else, so there is nothing for it to be atomic with.
 */
export class PrismaOrderNoteRepository implements IOrderNoteRepository {
  async listForOrder(orderId: string): Promise<OrderNote[]> {
    // Newest first, served straight out of `order_notes_order_id_created_at_idx`.
    const rows = await prisma.orderNote.findMany({
      where: { orderId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toOrderNote);
  }

  async listForOrders(orderIds: readonly string[]): Promise<OrderNote[]> {
    if (orderIds.length === 0) return [];

    const rows = await prisma.orderNote.findMany({
      where: { orderId: { in: [...orderIds] } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toOrderNote);
  }

  async create(input: NewOrderNote): Promise<OrderNote> {
    const row = await prisma.orderNote.create({ data: input });
    return toOrderNote(row);
  }
}

type OrderNoteRow = {
  id: string;
  orderId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: Date;
};

function toOrderNote(row: OrderNoteRow): OrderNote {
  return {
    id: row.id,
    orderId: row.orderId,
    authorId: row.authorId,
    authorName: row.authorName,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}
