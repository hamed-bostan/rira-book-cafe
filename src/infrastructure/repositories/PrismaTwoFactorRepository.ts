import type { NewActivityEntry } from "@/src/domain/entities/ActivityEntry";
import type { TwoFactorRecord, TwoFactorState } from "@/src/domain/entities/TwoFactor";
import type { ITwoFactorRepository } from "@/src/domain/repositories/ITwoFactorRepository";
import { prisma } from "@/src/infrastructure/prisma/client";

import { toActivityRow } from "./writeActivityEntry";

/**
 * Authenticator-app records in PostgreSQL via Prisma. Every state change is a
 * conditional write, so two tabs (or an attacker replaying a code) racing each
 * other get one winner rather than a mixed result.
 */
export class PrismaTwoFactorRepository implements ITwoFactorRepository {
  async get(userId: string): Promise<TwoFactorRecord | null> {
    const row = await prisma.userTwoFactor.findUnique({ where: { userId } });
    if (!row) return null;
    return {
      userId: row.userId,
      sealedSecret: row.sealedSecret,
      enabledAt: row.enabledAt,
      lastUsedStep: row.lastUsedStep,
      recoveryCodeHashes: row.recoveryCodeHashes,
    };
  }

  async statesOf(userIds: readonly string[]): Promise<Record<string, TwoFactorState>> {
    const rows = await prisma.userTwoFactor.findMany({
      where: { userId: { in: [...userIds] } },
      select: { userId: true, enabledAt: true },
    });
    const states: Record<string, TwoFactorState> = Object.fromEntries(userIds.map((id) => [id, "off" as const]));
    for (const row of rows) states[row.userId] = row.enabledAt ? "on" : "pending";
    return states;
  }

  async savePending(userId: string, sealedSecret: string): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.userTwoFactor.findUnique({ where: { userId }, select: { enabledAt: true } });
      if (existing?.enabledAt) return false;
      await tx.userTwoFactor.upsert({
        where: { userId },
        update: { sealedSecret, enabledAt: null, lastUsedStep: null, recoveryCodeHashes: [] },
        create: { userId, sealedSecret, recoveryCodeHashes: [] },
      });
      return true;
    });
  }

  async enable(
    userId: string,
    input: { sealedSecret: string; recoveryCodeHashes: string[]; step: number; at: Date },
    entry: NewActivityEntry,
  ): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const { count } = await tx.userTwoFactor.updateMany({
        where: { userId, enabledAt: null, sealedSecret: input.sealedSecret },
        data: { enabledAt: input.at, lastUsedStep: input.step, recoveryCodeHashes: input.recoveryCodeHashes },
      });
      if (count === 0) return false;
      await tx.activityEntry.create({ data: toActivityRow(entry) });
      return true;
    });
  }

  async useStep(userId: string, step: number): Promise<boolean> {
    const { count } = await prisma.userTwoFactor.updateMany({
      where: {
        userId,
        enabledAt: { not: null },
        OR: [{ lastUsedStep: null }, { lastUsedStep: { lt: step } }],
      },
      data: { lastUsedStep: step },
    });
    return count > 0;
  }

  async useRecoveryCode(userId: string, hash: string): Promise<boolean> {
    // One statement: remove the hash only if it's there, so a code can't be spent twice.
    const count = await prisma.$executeRaw`
      UPDATE "user_two_factor"
      SET "recovery_code_hashes" = array_remove("recovery_code_hashes", ${hash}), "updated_at" = NOW()
      WHERE "user_id" = ${userId} AND "enabled_at" IS NOT NULL AND ${hash} = ANY("recovery_code_hashes")`;
    return count > 0;
  }

  async remove(userId: string, entry?: NewActivityEntry): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const { count } = await tx.userTwoFactor.deleteMany({ where: { userId } });
      if (count > 0 && entry) await tx.activityEntry.create({ data: toActivityRow(entry) });
      // Every browser that passed the check did so against the factor just removed.
      if (count > 0) {
        await tx.userSession.updateMany({ where: { userId }, data: { twoFactorVerifiedAt: null } });
      }
      return count > 0;
    });
  }
}
