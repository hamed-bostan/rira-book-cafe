import {
  WEEKDAYS,
  isClockTime,
  type CafeProfile,
  type CafeSettings,
  type DayHours,
  type HoursException,
  type OpeningHours,
  type ReceiptSettings,
  type WeeklyHours,
} from "@/src/domain/entities/CafeSettings";
import { isCafeDay } from "@/src/domain/entities/CafeTime";
import type { AuditHook } from "@/src/domain/repositories/AuditHook";
import type { ICafeSettingsRepository } from "@/src/domain/repositories/ICafeSettingsRepository";
import { prisma } from "@/src/infrastructure/prisma/client";
import { Prisma, type CafeSettings as CafeSettingsRow } from "@/src/infrastructure/prisma/generated/client";
import { inTransaction, type PrismaDb } from "@/src/infrastructure/prisma/transaction";

import { recordAudit } from "./writeActivityEntry";

const ID = 1;

/** The cafe's settings row (id 1), backed by PostgreSQL via Prisma. The migration creates it. */
export class PrismaCafeSettingsRepository implements ICafeSettingsRepository {
  constructor(private readonly db: PrismaDb = prisma) {}

  async get(): Promise<CafeSettings> {
    return readSettings(this.db);
  }

  updateProfile(profile: CafeProfile, audit?: AuditHook<CafeSettings>): Promise<CafeSettings> {
    return this.write(
      {
        name: profile.name ?? null,
        nameFa: profile.nameFa ?? null,
        address: profile.address ?? null,
        addressFa: profile.addressFa ?? null,
        phone: profile.phone ?? null,
        instagram: profile.instagram ?? null,
        website: profile.website ?? null,
        latitude: profile.latitude ?? null,
        longitude: profile.longitude ?? null,
      },
      audit,
    );
  }

  updateHours(hours: OpeningHours, audit?: AuditHook<CafeSettings>): Promise<CafeSettings> {
    return this.write(
      {
        weeklyHours: hours.weekly ? hours.weekly : Prisma.DbNull,
        hoursExceptions: hours.exceptions,
      },
      audit,
    );
  }

  updateReceipt(receipt: ReceiptSettings, audit?: AuditHook<CafeSettings>): Promise<CafeSettings> {
    return this.write(
      {
        receiptHeader: receipt.header ?? null,
        receiptHeaderFa: receipt.headerFa ?? null,
        receiptFooter: receipt.footer ?? null,
        receiptFooterFa: receipt.footerFa ?? null,
      },
      audit,
    );
  }

  private write(data: Prisma.CafeSettingsUpdateInput, audit?: AuditHook<CafeSettings>): Promise<CafeSettings> {
    return inTransaction(this.db, async (tx) => {
      await tx.cafeSettings.upsert({
        where: { id: ID },
        create: { ...(data as Prisma.CafeSettingsCreateInput), id: ID },
        update: data,
      });
      const saved = await readSettings(tx);
      await recordAudit(tx, saved, audit);
      return saved;
    });
  }
}

async function readSettings(db: PrismaDb): Promise<CafeSettings> {
  const row = await db.cafeSettings.findUnique({ where: { id: ID } });
  return row ? toSettings(row) : { profile: {}, hours: { weekly: null, exceptions: [] }, receipt: {} };
}

function toSettings(row: CafeSettingsRow): CafeSettings {
  return {
    profile: compact({
      name: row.name,
      nameFa: row.nameFa,
      address: row.address,
      addressFa: row.addressFa,
      phone: row.phone,
      instagram: row.instagram,
      website: row.website,
      latitude: row.latitude,
      longitude: row.longitude,
    }),
    hours: { weekly: toWeekly(row.weeklyHours), exceptions: toExceptions(row.hoursExceptions) },
    receipt: compact({
      header: row.receiptHeader,
      headerFa: row.receiptHeaderFa,
      footer: row.receiptFooter,
      footerFa: row.receiptFooterFa,
    }),
  };
}

/** Drop the unset (`null`) columns, so the entity's optional fields are simply absent. */
function compact<T extends Record<string, unknown>>(value: T): { [K in keyof T]?: Exclude<T[K], null> } {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== null)) as {
    [K in keyof T]?: Exclude<T[K], null>;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * One day's hours as stored. The use-case only ever writes valid hours; this reads
 * defensively anyway (a hand-edited row), treating anything it can't read as closed.
 */
function toDayHours(value: unknown): DayHours {
  if (!isRecord(value) || value.closed !== false) return { closed: true };
  const { opens, closes } = value;
  if (typeof opens !== "string" || typeof closes !== "string" || !isClockTime(opens) || !isClockTime(closes)) {
    return { closed: true };
  }
  return { closed: false, opens, closes };
}

function toWeekly(value: Prisma.JsonValue | null): WeeklyHours | null {
  if (!isRecord(value)) return null;
  return Object.fromEntries(WEEKDAYS.map((day) => [day, toDayHours(value[day])])) as WeeklyHours;
}

function toExceptions(value: Prisma.JsonValue): HoursException[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): HoursException[] => {
    if (!isRecord(entry) || typeof entry.date !== "string" || !isCafeDay(entry.date)) return [];
    return [
      {
        date: entry.date,
        ...toDayHours(entry),
        ...(typeof entry.note === "string" && entry.note ? { note: entry.note } : {}),
        ...(typeof entry.noteFa === "string" && entry.noteFa ? { noteFa: entry.noteFa } : {}),
      },
    ];
  });
}
