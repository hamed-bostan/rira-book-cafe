import { Prisma } from "@prisma/client";

import type { User, UserRole } from "@/src/domain/entities/User";
import { toUserRole } from "@/src/domain/entities/User";
import { NotFoundError } from "@/src/domain/errors/NotFoundError";
import type { IUserRepository, NewUser, ProfileUpdate } from "@/src/domain/repositories/IUserRepository";
import { prisma } from "@/src/infrastructure/prisma/client";

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
