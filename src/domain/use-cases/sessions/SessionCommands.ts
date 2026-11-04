import {
  MAX_USER_AGENT_LENGTH,
  describeUserAgent,
  type DeviceDescription,
  type SessionCheck,
  type UserSession,
} from "../../entities/UserSession";
import { NotFoundError } from "../../errors/NotFoundError";

import type { ActivityActor, NewActivityEntry } from "../../entities/ActivityEntry";
import type { ISessionRepository } from "../../repositories/ISessionRepository";
import type { IUserRepository } from "../../repositories/IUserRepository";

/**
 * Signed-in browsers: recording a sign-in, checking a session on each request,
 * listing where someone is signed in, and signing browsers out.
 *
 * A member manages their own sessions; the owner can do the same for anyone on the
 * team. The owner's actions on someone else are recorded under the team's access
 * (`user.sessionsRevoked`). Signing yourself out of a browser is not: it changes
 * nothing anyone else relies on, and the log is for changes made to the cafe.
 */

/** Record a sign-in. The user agent is trimmed to a sane length — it's a request header. */
export class StartSession {
  constructor(private readonly sessions: ISessionRepository) {}

  execute(userId: string, userAgent: string | null, now: Date = new Date()): Promise<UserSession> {
    const agent = userAgent?.trim().slice(0, MAX_USER_AGENT_LENGTH) || null;
    return this.sessions.start({ userId, userAgent: agent, at: now });
  }
}

/** Is this session still good? `null` means the token must stop working. */
export class CheckSession {
  constructor(private readonly sessions: ISessionRepository) {}

  execute(sessionId: string, userId: string, now: Date = new Date()): Promise<SessionCheck | null> {
    return this.sessions.check(sessionId, now).then((check) => (check?.userId === userId ? check : null));
  }
}

/** A session as the sessions list shows it. */
export type SessionView = {
  id: string;
  device: DeviceDescription;
  signedInAt: Date;
  lastSeenAt: Date;
  /** The browser making this request. */
  current: boolean;
};

export class ListSessions {
  constructor(private readonly sessions: ISessionRepository) {}

  async execute(userId: string, currentSessionId: string | null, now: Date = new Date()): Promise<SessionView[]> {
    const active = await this.sessions.listActive(userId, now);
    return active.map((session) => ({
      id: session.id,
      device: describeUserAgent(session.userAgent),
      signedInAt: session.createdAt,
      lastSeenAt: session.lastSeenAt,
      current: session.id === currentSessionId,
    }));
  }
}

/** Who is signing out whose sessions. */
export type SessionTarget = {
  userId: string;
  actor: ActivityActor;
};

/**
 * Sign one browser out. `NotFoundError` when it isn't one of the user's active
 * sessions — whether it never was or already ended, the answer is the same.
 */
export class RevokeSession {
  constructor(
    private readonly sessions: ISessionRepository,
    private readonly users: Pick<IUserRepository, "getById">,
  ) {}

  async execute(target: SessionTarget, sessionId: string): Promise<void> {
    const entry = await revokeEntry(this.users, target, "1");
    const revoked = await this.sessions.revoke(target.userId, sessionId, entry);
    if (!revoked) throw new NotFoundError("session", sessionId);
  }
}

/**
 * Sign every browser out — or, for your own sessions, every one but the browser
 * you're using (`exceptId`), so "sign out everywhere else" doesn't sign you out
 * of the screen you clicked it on. Resolves how many ended.
 */
export class RevokeAllSessions {
  constructor(
    private readonly sessions: ISessionRepository,
    private readonly users: Pick<IUserRepository, "getById">,
  ) {}

  async execute(target: SessionTarget, exceptId?: string): Promise<number> {
    const entry = await revokeEntry(this.users, target, "all");
    return this.sessions.revokeAll(target.userId, { exceptId, entry });
  }
}

/** The owner's entry for signing someone else out; nothing for your own. */
async function revokeEntry(
  users: Pick<IUserRepository, "getById">,
  target: SessionTarget,
  which: "1" | "all",
): Promise<NewActivityEntry | undefined> {
  if (target.userId === target.actor.id) return undefined;
  const user = await users.getById(target.userId);
  if (!user) throw new NotFoundError("user", target.userId);
  return {
    actorId: target.actor.id,
    actorName: target.actor.name,
    action: "user.sessionsRevoked",
    entityType: "user",
    entityId: user.id,
    entityLabel: user.name,
    changes: [{ field: "sessionsSignedOut", before: null, after: which }],
  };
}
