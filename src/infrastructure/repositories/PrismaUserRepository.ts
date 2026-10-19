import { changedFields } from "@/src/domain/entities/ActivityEntry";
import type { User, UserRole } from "@/src/domain/entities/User";
import { PLACEHOLDER_USER_NAME, toUserRole } from "@/src/domain/entities/User";
import { NotFoundError } from "@/src/domain/errors/NotFoundError";
import type {
  IUserRepository,
  NewUser,
  ProfileUpdate,
  RoleChangeBatch,
} from "@/src/domain/repositories/IUserRepository";
import { prisma } from "@/src/infrastructure/prisma/client";
import { Prisma } from "@/src/infrastructure/prisma/generated/client";

/**
 * Users backed by PostgreSQL via Prisma. Server-side only (it opens a DB
 * connection), bound through the container — never imported by client code.
 */
export class PrismaUserRepository implements IUserRepository {
  async getById(id: string): Promise<User | null> {
    const row = await prisma.user.findUnique({ where: { id } });
    return row ? toUser(row) : null;
  }

  async create(input: NewUser): Promise<User> {
    const row = await prisma.user.create({
      data: {
        id: input.id,
        phone: input.phone,
        name: input.name,
        email: input.email ?? null,
        avatarUrl: input.avatarUrl ?? null,
        ...(input.role ? { role: input.role } : {}),
      },
    });
    return toUser(row);
  }

  async listByRoles(roles: readonly UserRole[]): Promise<User[]> {
    const rows = await prisma.user.findMany({
      where: { role: { in: [...roles] } },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toUser);
  }

  async applyRoleChanges(batch: RoleChangeBatch): Promise<User[]> {
    // An interactive transaction, not a batched array: each assignment needs a
    // read (see below) before its write, and the audit entries must land in the
    // same unit. Everything here commits together or not at all.
    return prisma.$transaction(async (tx) => {
      const written: User[] = [];

      for (const assignment of batch.assignments) {
        const email = assignment.email ?? null;
        // Only fill a *blank* address: the one supplied here is a delivery detail
        // typed by an admin, and must never clobber the address the user set on
        // their own profile. Read first, since an upsert can't express "write
        // only if empty".
        const existing = await tx.user.findUnique({
          where: { id: assignment.id },
          select: { email: true },
        });
        const fillEmail = email !== null && !existing?.email;

        // Upsert rather than update: a role can be granted before the person has
        // ever signed in, in which case we write the row they'd get at first
        // sign-in. The placeholder name is theirs to overwrite once they complete
        // their profile, and `GetOrCreateUser` leaves this row (and its role)
        // alone at sign-in.
        const row = await tx.user.upsert({
          where: { id: assignment.id },
          update: { role: assignment.role, ...(fillEmail ? { email } : {}) },
          create: {
            id: assignment.id,
            phone: assignment.phone,
            name: PLACEHOLDER_USER_NAME,
            role: assignment.role,
            email,
          },
        });
        written.push(toUser(row));
      }

      if (batch.entries.length > 0) {
        await tx.activityEntry.createMany({
          data: batch.entries.map((entry) => ({
            actorId: entry.actorId,
            actorName: entry.actorName,
            action: entry.action,
            entityType: entry.entityType,
            entityId: entry.entityId,
            entityLabel: entry.entityLabel ?? null,
            // Valid input JSON already; the cast only satisfies Prisma's Json type.
            changes: entry.changes,
            // Derived from the same diff, exactly as `PrismaActivityLog.record`
            // does — this is the other writer of the table, and it has to agree.
            changedFields: changedFields(entry.changes),
          })),
        });
      }

      return written;
    });
  }

  async update(id: string, input: ProfileUpdate): Promise<User> {
    try {
      const row = await prisma.user.update({ where: { id }, data: input });
      return toUser(row);
    } catch (error) {
      // P2025: the targeted row no longer exists (lost a race between a pre-write
      // existence check and the write). Surface it transport-agnostically.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        throw new NotFoundError("user", id, { cause: error });
      }
      throw error;
    }
  }
}

/** Map a Prisma row to the domain entity (dropping DB-only timestamps). */
function toUser(row: {
  id: string;
  phone: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  role: string;
}): User {
  return {
    id: row.id,
    phone: row.phone,
    name: row.name,
    email: row.email,
    avatarUrl: row.avatarUrl,
    // The column is a plain string (the schema is enum-free), so narrow it here
    // rather than trusting the database to hold only known values.
    role: toUserRole(row.role),
  };
}
