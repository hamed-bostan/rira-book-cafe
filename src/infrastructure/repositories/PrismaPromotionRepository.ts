import { Prisma } from "@prisma/client";

import { PROMO_KINDS, type PromoCode, type PromoCodeWithUses, type PromoKind, type PromoUsage } from "@/src/domain/entities/Promotion";
import { NotFoundError } from "@/src/domain/errors/NotFoundError";
import { UniqueConstraintError } from "@/src/domain/errors/UniqueConstraintError";
import type { AuditHook } from "@/src/domain/repositories/AuditHook";
import type { IPromotionRepository, PromoCodeInput } from "@/src/domain/repositories/IPromotionRepository";
import { prisma } from "@/src/infrastructure/prisma/client";
import { inTransaction, type PrismaDb } from "@/src/infrastructure/prisma/transaction";

import { recordAudit } from "./writeActivityEntry";

/** An order still counts as a use of its code unless it was cancelled. */
const LIVE_ORDER = { status: { not: "cancelled" } } satisfies Prisma.OrderWhereInput;

/**
 * Promo codes backed by PostgreSQL via Prisma. Uses aren't stored on the code —
 * they're counted from the orders that carry it, so a cancelled order gives its
 * use back without anyone remembering to.
 */
export class PrismaPromotionRepository implements IPromotionRepository {
  constructor(private readonly db: PrismaDb = prisma) {}

  async list(): Promise<PromoCodeWithUses[]> {
    const [rows, uses] = await Promise.all([
      this.db.promoCode.findMany({ orderBy: { createdAt: "desc" } }),
      this.db.order.groupBy({ by: ["promoCodeId"], where: { ...LIVE_ORDER, promoCodeId: { not: null } }, _count: { _all: true } }),
    ]);
    const usesById = new Map(uses.map((group) => [group.promoCodeId, group._count._all]));
    return rows.map((row) => ({ ...toPromo(row), uses: usesById.get(row.id) ?? 0 }));
  }

  async getById(id: string): Promise<PromoCode | null> {
    const row = await this.db.promoCode.findUnique({ where: { id } });
    return row ? toPromo(row) : null;
  }

  async getByCode(code: string): Promise<PromoCode | null> {
    const row = await this.db.promoCode.findUnique({ where: { code } });
    return row ? toPromo(row) : null;
  }

  async usage(promoId: string, userId: string): Promise<PromoUsage> {
    const [total, byGuest] = await Promise.all([
      this.db.order.count({ where: { ...LIVE_ORDER, promoCodeId: promoId } }),
      this.db.order.count({ where: { ...LIVE_ORDER, promoCodeId: promoId, userId } }),
    ]);
    return { total, byGuest };
  }

  async create(input: PromoCodeInput, audit?: AuditHook<PromoCode>): Promise<PromoCode> {
    try {
      return await inTransaction(this.db, async (tx) => {
        const saved = toPromo(await tx.promoCode.create({ data: toData(input) }));
        await recordAudit(tx, saved, audit);
        return saved;
      });
    } catch (error) {
      throw toDomainError(error);
    }
  }

  async update(id: string, input: PromoCodeInput, audit?: AuditHook<PromoCode>): Promise<PromoCode> {
    try {
      return await inTransaction(this.db, async (tx) => {
        const saved = toPromo(await tx.promoCode.update({ where: { id }, data: toData(input) }));
        await recordAudit(tx, saved, audit);
        return saved;
      });
    } catch (error) {
      throw toDomainError(error);
    }
  }
}

type PromoRow = Prisma.PromoCodeGetPayload<object>;

function toData(input: PromoCodeInput): Prisma.PromoCodeCreateInput {
  return {
    code: input.code,
    description: input.description ?? null,
    kind: input.kind,
    value: input.value,
    maxDiscount: input.maxDiscount ?? null,
    minSubtotal: input.minSubtotal,
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
    usageLimit: input.usageLimit ?? null,
    perGuestLimit: input.perGuestLimit ?? null,
    isActive: input.isActive,
  };
}

function toKind(value: string): PromoKind {
  return (PROMO_KINDS as readonly string[]).includes(value) ? (value as PromoKind) : "fixed";
}

function toPromo(row: PromoRow): PromoCode {
  return {
    id: row.id,
    code: row.code,
    description: row.description ?? undefined,
    kind: toKind(row.kind),
    value: row.value,
    maxDiscount: row.maxDiscount ?? undefined,
    minSubtotal: row.minSubtotal,
    startsAt: row.startsAt?.toISOString(),
    endsAt: row.endsAt?.toISOString(),
    usageLimit: row.usageLimit ?? undefined,
    perGuestLimit: row.perGuestLimit ?? undefined,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** A taken code is the domain's unique-constraint error; a vanished one is not found. */
function toDomainError(error: unknown): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return new UniqueConstraintError(["code"], { cause: error });
    if (error.code === "P2025") return new NotFoundError("promo code", undefined, { cause: error });
  }
  return error;
}
