import { afterAll, beforeEach, vi } from "vitest";

import { prisma } from "@/src/infrastructure/prisma/client";

import { restoreTestDatabase } from "../fixtures/database";

import { signInAs } from "./helpers/session";

// Auth.js is the one thing faked: its `auth()` reads a signed cookie inside a Next
// request scope, which a handler called directly doesn't have. Tests pick the
// signed-in user with `signInAs`; everything behind it — the role lookup, the
// permission check, the handler, the use-case, Prisma — runs for real.
vi.mock("@/auth", async () => {
  const { currentSession } = await import("./helpers/session");
  return {
    auth: async () => currentSession(),
    handlers: {},
    signIn: vi.fn(),
    signOut: vi.fn(),
  };
});

// Write routes expire cached catalog reads (`invalidatesCatalog`); `revalidateTag`
// needs the Next request scope a directly called handler doesn't have. Recorded
// instead, so a test can assert which tags a write expired.
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

// Every test starts from the same database, signed out.
beforeEach(async () => {
  await restoreTestDatabase();
  signInAs(null);
  vi.clearAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
});
