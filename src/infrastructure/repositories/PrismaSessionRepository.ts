import type { NewActivityEntry } from "@/src/domain/entities/ActivityEntry";
import {
  SESSION_MAX_AGE_MS,
  SESSION_TOUCH_INTERVAL_MS,
  type SessionCheck,
  type UserSession,
} from "@/src/domain/entities/UserSession";
import type { ISessionRepository } from "@/src/domain/repositories/ISessionRepository";
import { prisma } from "@/src/infrastructure/prisma/client";

import { toActivityRow } from "./writeActivityEntry";

/**
 * Signed-in sessions in PostgreSQL via Prisma. `check` runs on every request that
 * reads the session, so it's one primary-key read, plus a write at most every few
 * minutes to keep last-seen roughly current.
 */
export class PrismaSessionRepository implements ISessionRepository {
  async start(input: { userId: string; userAgent: string | null; at: Date }): Promise<UserSession> {
    const row = await prisma.userSession.create({
      data: { userId: input.userId, userAgent: input.userAgent, createdAt: input.at, lastSeenAt: input.at },
    });
    return row;
  }

  async check(id: string, now: Date): Promise<SessionCheck | null> {
    const row = await prisma.userSession.findUnique({
      where: { id },
      select: { userId: true, lastSeenAt: true, revokedAt: true },
    });
    if (!row || row.revokedAt) return null;
    const idle = now.getTime() - row.lastSeenAt.getTime();
    if (idle >= SESSION_MAX_AGE_MS) return null;
    if (idle >= SESSION_TOUCH_INTERVAL_MS) {
      // Conditional, so a revoke landing meanwhile isn't undone and two requests
      // racing to touch it write once.
      await prisma.userSession.updateMany({
        where: { id, revokedAt: null, lastSeenAt: row.lastSeenAt },
        data: { lastSeenAt: now },
      });
    }
    return { userId: row.userId };
  }

  async listActive(userId: string, now: Date): Promise<UserSession[]> {
    return prisma.userSession.findMany({
      where: { userId, revokedAt: null, lastSeenAt: { gt: new Date(now.getTime() - SESSION_MAX_AGE_MS) } },
      orderBy: { lastSeenAt: "desc" },
    });
  }

  async revoke(userId: string, sessionId: string, entry?: NewActivityEntry): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const { count } = await tx.userSession.updateMany({
        where: { id: sessionId, userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (count > 0 && entry) await tx.activityEntry.create({ data: toActivityRow(entry) });
      return count > 0;
    });
  }

  async revokeAll(userId: string, options: { exceptId?: string; entry?: NewActivityEntry } = {}): Promise<number> {
    return prisma.$transaction(async (tx) => {
      const { count } = await tx.userSession.updateMany({
        where: { userId, revokedAt: null, ...(options.exceptId ? { id: { not: options.exceptId } } : {}) },
        data: { revokedAt: new Date() },
      });
      // Nothing was signed out, so there's nothing to record.
      if (count > 0 && options.entry) await tx.activityEntry.create({ data: toActivityRow(options.entry) });
      return count;
    });
  }

  async pruneInactive(before: Date, batchSize: number): Promise<number> {
    let total = 0;
    for (;;) {
      const batch = await prisma.userSession.findMany({
        where: { OR: [{ revokedAt: { not: null } }, { lastSeenAt: { lt: before } }] },
        select: { id: true },
        take: batchSize,
      });
      if (batch.length === 0) return total;
      const { count } = await prisma.userSession.deleteMany({ where: { id: { in: batch.map((row) => row.id) } } });
      total += count;
      if (batch.length < batchSize) return total;
    }
  }
}
