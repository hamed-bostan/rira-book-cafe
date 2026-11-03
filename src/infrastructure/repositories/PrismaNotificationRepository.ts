import {
  NOTIFICATION_KINDS,
  type NewNotification,
  type Notification,
  type NotificationKind,
  type NotificationParams,
} from "@/src/domain/entities/Notification";
import type { AuditHook } from "@/src/domain/repositories/AuditHook";
import type { INotificationRepository } from "@/src/domain/repositories/INotificationRepository";
import { prisma } from "@/src/infrastructure/prisma/client";
import { Prisma } from "@/src/infrastructure/prisma/generated/client";
import { inTransaction, type PrismaDb } from "@/src/infrastructure/prisma/transaction";

import { recordAudit } from "./writeActivityEntry";

/**
 * Guest notifications backed by PostgreSQL via Prisma. Server-side only, bound
 * through the container — never imported by client code.
 */
export class PrismaNotificationRepository implements INotificationRepository {
  constructor(private readonly db: PrismaDb = prisma) {}

  async create(input: NewNotification, audit?: AuditHook<Notification>): Promise<Notification | null> {
    const write = async (db: PrismaDb): Promise<Notification> => {
      const row = await db.notification.create({
        data: {
          userId: input.userId,
          kind: input.kind,
          params: input.params,
          link: input.link ?? null,
          dedupeKey: input.dedupeKey ?? null,
        },
      });
      return toNotification(row);
    };
    try {
      if (!audit) return await write(this.db);
      // A message staff wrote: its activity entry commits with it or not at all.
      return await inTransaction(this.db, async (tx) => {
        const notification = await write(tx);
        await recordAudit(tx, notification, audit);
        return notification;
      });
    } catch (error) {
      // Already sent once (same dedupe key): that's the point of the key, not a failure.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return null;
      throw error;
    }
  }

  async listForUser(userId: string, limit: number): Promise<Notification[]> {
    const rows = await this.db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map(toNotification);
  }

  countUnread(userId: string): Promise<number> {
    return this.db.notification.count({ where: { userId, readAt: null } });
  }

  async markAllRead(userId: string, at: Date): Promise<void> {
    await this.db.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: at } });
  }
}

type NotificationRow = Prisma.NotificationGetPayload<object>;

function toKind(value: string): NotificationKind {
  return (NOTIFICATION_KINDS as readonly string[]).includes(value) ? (value as NotificationKind) : "orderAccepted";
}

/** Only flat string/number values survive — anything else in the column is ignored rather than trusted. */
function toParams(value: Prisma.JsonValue): NotificationParams {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const params: NotificationParams = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string" || typeof entry === "number") params[key] = entry;
  }
  return params;
}

function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.userId,
    kind: toKind(row.kind),
    params: toParams(row.params),
    link: row.link ?? undefined,
    readAt: row.readAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}
