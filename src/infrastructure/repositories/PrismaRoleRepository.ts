import { randomBytes } from "node:crypto";

import { isPermission, ROLE_PERMISSIONS, type Permission } from "@/src/domain/entities/Permission";
import { RolePolicy, type RoleDefinition } from "@/src/domain/entities/Role";
import {
  EDITABLE_BUILT_IN_ROLES,
  isCustomRoleKey,
  type CustomRoleKey,
  type GrantableBuiltInRole,
} from "@/src/domain/entities/User";
import { ConflictError } from "@/src/domain/errors/ConflictError";
import { NotFoundError } from "@/src/domain/errors/NotFoundError";
import type { AuditHook } from "@/src/domain/repositories/AuditHook";
import type { IRoleRepository, NewRole, RoleChanges } from "@/src/domain/repositories/IRoleRepository";
import { prisma } from "@/src/infrastructure/prisma/client";

import { recordAudit } from "./writeActivityEntry";

/**
 * How long a cached policy is trusted before it's read again even without a write
 * in this process. Writes here drop the cache at once, so on the single container
 * the app runs as, a change applies on the very next request; this bound is for
 * a second instance, which can't hear about another's writes.
 */
const POLICY_TTL_MS = 30_000;

type RoleRow = {
  key: string;
  builtIn: boolean;
  nameEn: string | null;
  nameFa: string | null;
  permissions: string[];
};

type CachedPolicy = { policy: RolePolicy; loadedAt: number };

/** Process-wide, so every repository instance (and dev re-evaluation) shares one cache. */
const cacheRegistry = globalThis as typeof globalThis & { __rolePolicyCache?: { value: CachedPolicy | null } };
const policyCache = (cacheRegistry.__rolePolicyCache ??= { value: null });

/**
 * Dashboard roles in PostgreSQL via Prisma, and the cached `RolePolicy` built from
 * them. Server-side only, bound through the container.
 */
export class PrismaRoleRepository implements IRoleRepository {
  constructor(private readonly clock: () => number = Date.now) {}

  async list(): Promise<RoleDefinition[]> {
    const rows = await prisma.role.findMany({ orderBy: { createdAt: "asc" } });
    const stored = new Map(rows.map((row) => [row.key, row]));
    // The editable built-ins always appear, stored or not, in their usual order.
    const builtIns = EDITABLE_BUILT_IN_ROLES.map((key) => builtInDefinition(key, stored.get(key)));
    const custom = rows.filter((row) => isCustomRoleKey(row.key)).map(toDefinition);
    return [...builtIns, ...custom];
  }

  async get(key: GrantableBuiltInRole | CustomRoleKey): Promise<RoleDefinition | null> {
    const row = await prisma.role.findUnique({ where: { key } });
    if (isCustomRoleKey(key)) return row ? toDefinition(row) : null;
    return (EDITABLE_BUILT_IN_ROLES as readonly string[]).includes(key)
      ? builtInDefinition(key, row ?? undefined)
      : null;
  }

  async policy(): Promise<RolePolicy> {
    const cached = policyCache.value;
    if (cached && this.clock() - cached.loadedAt < POLICY_TTL_MS) return cached.policy;
    const loadedAt = this.clock();
    const policy = new RolePolicy(await this.list());
    policyCache.value = { policy, loadedAt };
    return policy;
  }

  async memberCounts(): Promise<Record<string, number>> {
    const groups = await prisma.user.groupBy({ by: ["role"], where: { role: { not: "customer" } }, _count: true });
    return Object.fromEntries(groups.map((group) => [group.role, group._count]));
  }

  async create(input: NewRole, audit?: AuditHook<RoleDefinition>): Promise<RoleDefinition> {
    const key: CustomRoleKey = `custom:${randomBytes(8).toString("hex")}`;
    try {
      return await prisma.$transaction(async (tx) => {
        const row = await tx.role.create({
          data: { key, builtIn: false, nameEn: input.name.en, nameFa: input.name.fa, permissions: input.permissions },
        });
        const created = toDefinition(row);
        await recordAudit(tx, created, audit);
        return created;
      });
    } finally {
      invalidatePolicy();
    }
  }

  async update(
    key: GrantableBuiltInRole | CustomRoleKey,
    changes: RoleChanges,
    audit?: AuditHook<RoleDefinition>,
  ): Promise<RoleDefinition> {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.role.findUnique({ where: { key } });
        if (isCustomRoleKey(key) && !existing) throw new NotFoundError("role", key);
        if (!isCustomRoleKey(key) && !(EDITABLE_BUILT_IN_ROLES as readonly string[]).includes(key)) {
          throw new NotFoundError("role", key);
        }

        const data = {
          ...(changes.name ? { nameEn: changes.name.en, nameFa: changes.name.fa } : {}),
          ...(changes.permissions ? { permissions: changes.permissions } : {}),
        };
        // A built-in role with no row yet (a database the seed didn't reach) gets
        // one now, starting from its default set.
        const row = await tx.role.upsert({
          where: { key },
          update: data,
          create: {
            key,
            builtIn: true,
            permissions: changes.permissions ?? [...ROLE_PERMISSIONS[key as GrantableBuiltInRole]],
          },
        });
        const updated = isCustomRoleKey(key) ? toDefinition(row) : builtInDefinition(key, row);
        await recordAudit(tx, updated, audit);
        return updated;
      });
    } finally {
      invalidatePolicy();
    }
  }

  async delete(key: CustomRoleKey, audit?: AuditHook<RoleDefinition>): Promise<void> {
    try {
      await prisma.$transaction(async (tx) => {
        // Lock the role row so a grant of it can't commit between the count and the delete.
        const locked = await tx.$queryRaw<RoleRow[]>`
          SELECT "key", "built_in" AS "builtIn", "name_en" AS "nameEn", "name_fa" AS "nameFa", "permissions"
          FROM "roles" WHERE "key" = ${key} FOR UPDATE`;
        if (locked.length === 0) throw new NotFoundError("role", key);
        const holders = await tx.user.count({ where: { role: key } });
        if (holders > 0) {
          throw new ConflictError("ROLE_IN_USE", "Someone still has this role. Move them to another role first.");
        }
        await tx.role.delete({ where: { key } });
        await recordAudit(tx, toDefinition(locked[0]), audit);
      });
    } finally {
      invalidatePolicy();
    }
  }
}

/** Drop the cached policy — every write above calls this, success or not. */
export function invalidatePolicy(): void {
  policyCache.value = null;
}

function permissionsOf(values: readonly string[]): Permission[] {
  return values.filter(isPermission);
}

function builtInDefinition(key: GrantableBuiltInRole, row: RoleRow | undefined): RoleDefinition {
  return {
    key,
    builtIn: true,
    name: null,
    permissions: row ? permissionsOf(row.permissions) : [...ROLE_PERMISSIONS[key]],
  };
}

function toDefinition(row: RoleRow): RoleDefinition {
  return {
    key: row.key as CustomRoleKey,
    builtIn: false,
    name: { en: row.nameEn ?? row.key, fa: row.nameFa ?? row.nameEn ?? row.key },
    permissions: permissionsOf(row.permissions),
  };
}
