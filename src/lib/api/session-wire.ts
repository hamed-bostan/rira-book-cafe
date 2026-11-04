import type { SessionView } from "@/src/domain/use-cases/sessions/SessionCommands";

/** A session as it crosses the wire: dates as ISO strings (see `session-response-schema`). */
export type SessionWireBody = Omit<SessionView, "signedInAt" | "lastSeenAt"> & {
  signedInAt: string;
  lastSeenAt: string;
};

export function toSessionWire(session: SessionView): SessionWireBody {
  return { ...session, signedInAt: session.signedInAt.toISOString(), lastSeenAt: session.lastSeenAt.toISOString() };
}
