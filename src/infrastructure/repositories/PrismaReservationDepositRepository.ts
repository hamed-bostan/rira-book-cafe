import type { Reservation } from "@/src/domain/entities/Reservation";
import {
  DEPOSIT_SETTLING_STATUSES,
  DEPOSIT_TAKING_STATUSES,
  type ReservationDeposit,
  type ReservationDepositSettlement,
} from "@/src/domain/entities/ReservationDeposit";
import { ConflictError } from "@/src/domain/errors/ConflictError";
import { NotFoundError } from "@/src/domain/errors/NotFoundError";
import type { AuditHook } from "@/src/domain/repositories/AuditHook";
import type { LedgerHook } from "@/src/domain/repositories/ILedgerRepository";
import type { IReservationDepositRepository } from "@/src/domain/repositories/IReservationDepositRepository";
import { prisma } from "@/src/infrastructure/prisma/client";
import type { Prisma } from "@/src/infrastructure/prisma/generated/client";
import { inTransaction, type PrismaDb } from "@/src/infrastructure/prisma/transaction";

import { toReservation } from "./PrismaReservationRepository";
import { recordAudit } from "./writeActivityEntry";
import { postHook } from "./writeJournal";

/**
 * Table deposits backed by PostgreSQL. A deposit can't exist without its journal
 * entry: the row and the entry commit together, like a book loan's.
 */
export class PrismaReservationDepositRepository implements IReservationDepositRepository {
  constructor(private readonly db: PrismaDb = prisma) {}

  async takeDeposit(
    id: string,
    deposit: Omit<ReservationDeposit, "state">,
    ledger: LedgerHook<Reservation>,
    audit?: AuditHook<Reservation>,
  ): Promise<Reservation> {
    return this.write(
      id,
      { depositAmount: BigInt(0), status: { in: [...DEPOSIT_TAKING_STATUSES] } },
      { depositAmount: BigInt(deposit.amount), depositMethod: deposit.method, depositState: "held" },
      "This booking already has a deposit, or it's over.",
      ledger,
      audit,
    );
  }

  async settleDeposit(
    id: string,
    to: ReservationDepositSettlement,
    ledger: LedgerHook<Reservation>,
    audit?: AuditHook<Reservation>,
  ): Promise<Reservation> {
    return this.write(
      id,
      { depositState: "held", status: { in: [...DEPOSIT_SETTLING_STATUSES] } },
      { depositState: to },
      "This deposit was already settled, or the booking isn't over yet.",
      ledger,
      audit,
    );
  }

  /** One guarded update, its entries and its audit entry, in one transaction. */
  private write(
    id: string,
    guard: Prisma.ReservationWhereInput,
    data: Prisma.ReservationUpdateManyMutationInput,
    refused: string,
    ledger: LedgerHook<Reservation>,
    audit?: AuditHook<Reservation>,
  ): Promise<Reservation> {
    return inTransaction(this.db, async (tx) => {
      const result = await tx.reservation.updateMany({ where: { id, ...guard }, data });
      if (result.count === 0) {
        const exists = await tx.reservation.findUnique({ where: { id }, select: { id: true } });
        if (!exists) throw new NotFoundError("reservation", id);
        throw new ConflictError("INVALID_TRANSITION", refused);
      }
      const saved = toReservation(await tx.reservation.findUniqueOrThrow({ where: { id } }));
      await postHook(tx, saved, ledger);
      await recordAudit(tx, saved, audit);
      return saved;
    });
  }
}
