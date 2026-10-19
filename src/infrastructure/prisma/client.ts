import { createPrismaClient } from "@/src/infrastructure/prisma/createPrismaClient";
import type { PrismaClient } from "@/src/infrastructure/prisma/generated/client";

// One PrismaClient per process. In dev, hot-reload would otherwise spawn a new
// client (and connection pool) on every change, so we stash it on globalThis.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
