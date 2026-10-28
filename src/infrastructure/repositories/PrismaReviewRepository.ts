import {
  ratingSummary,
  REVIEW_STATUSES,
  type ModerationStatus,
  type ProductReview,
  type ReviewStatus,
} from "@/src/domain/entities/ProductReview";
import { ConflictError } from "@/src/domain/errors/ConflictError";
import { NotFoundError } from "@/src/domain/errors/NotFoundError";
import type { AuditHook } from "@/src/domain/repositories/AuditHook";
import type { IReviewRepository, ReviewDraft, ReviewFilters } from "@/src/domain/repositories/IReviewRepository";
import { prisma } from "@/src/infrastructure/prisma/client";
import type { Prisma } from "@/src/infrastructure/prisma/generated/client";
import { inTransaction, type PrismaDb } from "@/src/infrastructure/prisma/transaction";

import { recordAudit } from "./writeActivityEntry";

/** The queue is a working view, not an archive. */
const LIST_LIMIT = 200;

/**
 * Product reviews backed by PostgreSQL via Prisma. Every write that can change
 * which reviews are approved recomputes the item's `rating`/`ratingCount` in the
 * same transaction, so the stars on the menu always match the reviews behind them.
 */
export class PrismaReviewRepository implements IReviewRepository {
  constructor(private readonly db: PrismaDb = prisma) {}

  async saveOwn(draft: ReviewDraft): Promise<ProductReview> {
    return inTransaction(this.db, async (tx) => {
      const data = {
        productName: draft.productName,
        authorName: draft.authorName,
        rating: draft.rating,
        comment: draft.comment ?? null,
        // A new or rewritten review waits for staff again.
        status: "pending",
        moderatedById: null,
        moderatedByName: null,
        moderatedAt: null,
      };
      const row = await tx.productReview.upsert({
        where: { productId_userId: { productId: draft.productId, userId: draft.userId } },
        create: { ...data, productId: draft.productId, userId: draft.userId },
        update: data,
      });
      await refreshProductRating(tx, draft.productId);
      return toReview(row);
    });
  }

  async getById(id: string): Promise<ProductReview | null> {
    const row = await this.db.productReview.findUnique({ where: { id } });
    return row ? toReview(row) : null;
  }

  async getOwn(productId: string, userId: string): Promise<ProductReview | null> {
    const row = await this.db.productReview.findUnique({ where: { productId_userId: { productId, userId } } });
    return row ? toReview(row) : null;
  }

  async listApproved(productId: string, limit: number): Promise<ProductReview[]> {
    const rows = await this.db.productReview.findMany({
      where: { productId, status: "approved" },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map(toReview);
  }

  async list(filters: ReviewFilters): Promise<ProductReview[]> {
    const where: Prisma.ProductReviewWhereInput = filters.view === "all" ? {} : { status: filters.view };
    if (filters.q) {
      where.OR = [
        { productName: { contains: filters.q, mode: "insensitive" } },
        { authorName: { contains: filters.q, mode: "insensitive" } },
        { comment: { contains: filters.q, mode: "insensitive" } },
      ];
    }
    const rows = await this.db.productReview.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: LIST_LIMIT,
    });
    return rows.map(toReview);
  }

  async countByStatus(): Promise<Record<ReviewStatus, number>> {
    const groups = await this.db.productReview.groupBy({ by: ["status"], _count: { _all: true } });
    const counts = Object.fromEntries(REVIEW_STATUSES.map((status) => [status, 0])) as Record<ReviewStatus, number>;
    for (const group of groups) counts[toStatus(group.status)] += group._count._all;
    return counts;
  }

  async approvedRatingTotals(): Promise<{ sum: number; count: number }> {
    const totals = await this.db.productReview.aggregate({
      where: { status: "approved" },
      _sum: { rating: true },
      _count: { _all: true },
    });
    return { sum: totals._sum.rating ?? 0, count: totals._count._all };
  }

  async hasPurchased(userId: string, productId: string): Promise<boolean> {
    const line = await this.db.orderItem.findFirst({
      where: { productId, order: { userId, status: "completed" } },
      select: { id: true },
    });
    return line !== null;
  }

  async moderate(
    id: string,
    expectedStatus: ReviewStatus,
    status: ModerationStatus,
    moderator: { id: string; name: string },
    at: Date,
    audit?: AuditHook<ProductReview>,
  ): Promise<ProductReview> {
    return inTransaction(this.db, async (tx) => {
      // Guarded on the status staff saw: a rewrite or another moderator in the meantime wins.
      const result = await tx.productReview.updateMany({
        where: { id, status: expectedStatus },
        data: { status, moderatedById: moderator.id, moderatedByName: moderator.name, moderatedAt: at },
      });
      if (result.count === 0) {
        if (!(await tx.productReview.findUnique({ where: { id }, select: { id: true } })))
          throw new NotFoundError("review", id);
        throw new ConflictError("INVALID_TRANSITION", "This review was just changed.");
      }
      const row = await tx.productReview.findUniqueOrThrow({ where: { id } });
      await refreshProductRating(tx, row.productId);
      const saved = toReview(row);
      await recordAudit(tx, saved, audit);
      return saved;
    });
  }
}

/** Recompute an item's stars from its approved reviews (the item may have been deleted since — then there's nothing to update). */
async function refreshProductRating(tx: Prisma.TransactionClient, productId: string): Promise<void> {
  const approved = await tx.productReview.findMany({
    where: { productId, status: "approved" },
    select: { rating: true },
  });
  const summary = ratingSummary(approved.map((review) => review.rating));
  await tx.product.updateMany({ where: { id: productId }, data: summary });
}

type ReviewRow = Prisma.ProductReviewGetPayload<object>;

function toStatus(value: string): ReviewStatus {
  return (REVIEW_STATUSES as readonly string[]).includes(value) ? (value as ReviewStatus) : "pending";
}

function toReview(row: ReviewRow): ProductReview {
  return {
    id: row.id,
    productId: row.productId,
    productName: row.productName,
    userId: row.userId,
    authorName: row.authorName,
    rating: row.rating,
    comment: row.comment ?? undefined,
    status: toStatus(row.status),
    moderatedByName: row.moderatedByName ?? undefined,
    moderatedAt: row.moderatedAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
