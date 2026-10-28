import {
  PROMO_KINDS,
  promoCodeKey,
  type PromoCode,
  type PromoCodeWithUses,
  type PromoKind,
  type PromoUsage,
} from "@/src/domain/entities/Promotion";
import { NotFoundError } from "@/src/domain/errors/NotFoundError";
import { UniqueConstraintError } from "@/src/domain/errors/UniqueConstraintError";
import type { AuditHook } from "@/src/domain/repositories/AuditHook";
import type { IPromotionRepository, PromoCodeInput } from "@/src/domain/repositories/IPromotionRepository";
import { prisma } from "@/src/infrastructure/prisma/client";
import { Prisma } from "@/src/infrastructure/prisma/generated/client";
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
      this.db.order.groupBy({
        by: ["promoCodeId"],
        where: { ...LIVE_ORDER, promoCodeId: { not: null } },
        _count: { _all: true },
      }),
    ]);
    const usesById = new Map(uses.map((group) => [group.promoCodeId, group._count._all]));
    return rows.map((row) => ({ ...toPromo(row), uses: usesById.get(row.id) ?? 0 }));
  }

  async getById(id: string): Promise<PromoCode | null> {
    const row = await this.db.promoCode.findUnique({ where: { id } });
    return row ? toPromo(row) : null;
  }

  async getByCode(code: string): Promise<PromoCode | null> {
    const key = promoCodeKey(code);
    if (key === "") return null;
    // One query: every code whose letters and numbers are the typed ones, the one
    // saved exactly as typed first, then the plain letters-and-numbers one. Two
    // rows are enough to tell a clear winner from a tie. Columns are aliased to the
    // model's field names so a row reads like Prisma's own.
    const [best, next] = await this.db.$queryRaw<PromoRow[]>`
      SELECT id, code, description, kind, value,
        max_discount AS "maxDiscount", min_subtotal AS "minSubtotal",
        starts_at AS "startsAt", ends_at AS "endsAt",
        usage_limit AS "usageLimit", per_guest_limit AS "perGuestLimit",
        is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
      FROM promo_codes
      WHERE regexp_replace(upper(code), '[[:space:]_-]', '', 'g') = ${key}
      ORDER BY (code = ${code}) DESC, (code = ${key}) DESC, created_at
      LIMIT 2`;
    if (!best) return null;
    // Old codes that differ only in separators ("AUTUMN-15", "AUTUMN_15"), typed
    // as neither: no telling which was meant.
    if (next && best.code !== code && best.code !== key) return null;
    return toPromo(best);
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

  async delete(id: string, audit?: AuditHook<void>): Promise<void> {
    try {
      await inTransaction(this.db, async (tx) => {
        // Orders carry the code's id without a foreign key, alongside the code
        // and discount they got — deleting it leaves them as they were.
        await tx.promoCode.delete({ where: { id } });
        await recordAudit(tx, undefined, audit);
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
