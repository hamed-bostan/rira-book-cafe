import { describe, expect, it, vi } from "vitest";

import { NotFoundError } from "../../../errors/NotFoundError";
import { CheckSession, ListSessions, RevokeAllSessions, RevokeSession, StartSession } from "../SessionCommands";

import type { ISessionRepository } from "../../../repositories/ISessionRepository";

const NOW = new Date("2026-11-04T10:00:00Z");
const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

function sessionsRepo() {
  return {
    start: vi.fn<ISessionRepository["start"]>(async (input) => ({
      id: "s1",
      userId: input.userId,
      userAgent: input.userAgent,
      createdAt: input.at,
      lastSeenAt: input.at,
      revokedAt: null,
    })),
    check: vi.fn<ISessionRepository["check"]>(async (id) => (id === "s1" ? { userId: "u1" } : null)),
    listActive: vi.fn<ISessionRepository["listActive"]>(async () => [
      {
        id: "s1",
        userId: "u1",
        userAgent: CHROME,
        createdAt: NOW,
        lastSeenAt: NOW,
        revokedAt: null,
      },
      {
        id: "s2",
        userId: "u1",
        userAgent: null,
        createdAt: NOW,
        lastSeenAt: NOW,
        revokedAt: null,
      },
    ]),
    revoke: vi.fn<ISessionRepository["revoke"]>(async (_userId, sessionId) => sessionId === "s2"),
    revokeAll: vi.fn<ISessionRepository["revokeAll"]>(async () => 3),
    pruneInactive: vi.fn<ISessionRepository["pruneInactive"]>(async () => 0),
  } satisfies ISessionRepository;
}

const users = {
  getById: async (id: string) => ({
    id,
    phone: id,
    name: "Kian",
    email: null,
    avatarUrl: null,
    role: "staff" as const,
  }),
};

describe("StartSession", () => {
  it("records the sign-in, trimming an absurd user agent", async () => {
    const repo = sessionsRepo();
    await new StartSession(repo).execute("u1", "x".repeat(1000), NOW);
    expect(repo.start.mock.calls[0][0].userAgent).toHaveLength(400);
    await new StartSession(repo).execute("u1", "   ", NOW);
    expect(repo.start.mock.calls[1][0].userAgent).toBeNull();
  });
});

describe("CheckSession", () => {
  it("answers only for the session's own user", async () => {
    const repo = sessionsRepo();
    expect(await new CheckSession(repo).execute("s1", "u1", NOW)).toEqual({ userId: "u1" });
    expect(await new CheckSession(repo).execute("s1", "someone-else", NOW)).toBeNull();
    expect(await new CheckSession(repo).execute("gone", "u1", NOW)).toBeNull();
  });
});

describe("ListSessions", () => {
  it("describes each browser and marks the current one", async () => {
    const list = await new ListSessions(sessionsRepo()).execute("u1", "s1", NOW);
    expect(list[0]).toMatchObject({ id: "s1", current: true, device: { browser: "Chrome", os: "Windows" } });
    expect(list[1]).toMatchObject({ id: "s2", current: false, device: { kind: "unknown" } });
  });
});

describe("revoking sessions", () => {
  it("records nothing when you sign out your own browser", async () => {
    const repo = sessionsRepo();
    await new RevokeSession(repo, users).execute({ userId: "u1", actor: { id: "u1", name: "Sara" } }, "s2");
    expect(repo.revoke).toHaveBeenCalledWith("u1", "s2", undefined);
  });

  it("records the owner signing someone else out", async () => {
    const repo = sessionsRepo();
    await new RevokeAllSessions(repo, users).execute({ userId: "m1", actor: { id: "owner", name: "Rira" } });
    expect(repo.revokeAll).toHaveBeenCalledWith("m1", {
      exceptId: undefined,
      entry: expect.objectContaining({
        action: "user.sessionsRevoked",
        entityId: "m1",
        entityLabel: "Kian",
        changes: [{ field: "sessionsSignedOut", before: null, after: "all" }],
      }),
    });
  });

  it("keeps this browser when signing yourself out everywhere else", async () => {
    const repo = sessionsRepo();
    await new RevokeAllSessions(repo, users).execute({ userId: "u1", actor: { id: "u1", name: "Sara" } }, "s1");
    expect(repo.revokeAll).toHaveBeenCalledWith("u1", { exceptId: "s1", entry: undefined });
  });

  it("answers not-found for a session that isn't one of theirs", async () => {
    await expect(
      new RevokeSession(sessionsRepo(), users).execute({ userId: "u1", actor: { id: "u1", name: "Sara" } }, "nope"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
