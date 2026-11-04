/**
 * One signed-in browser.
 *
 * Auth.js keeps sessions in a signed JWT cookie, which on its own can't be taken
 * back before it expires. So each sign-in also writes a row here and the token
 * carries the row's id; every request checks the row, and revoking it signs that
 * browser out on its next request. The row is also what the "where you're signed
 * in" list reads.
 */
export type UserSession = {
  id: string;
  userId: string;
  /** The browser's `User-Agent` at sign-in, for "Chrome on Android"; null when it sent none. */
  userAgent: string | null;
  createdAt: Date;
  /** Approximate: refreshed at most every {@link SESSION_TOUCH_INTERVAL_MS}. */
  lastSeenAt: Date;
  revokedAt: Date | null;
};

/**
 * How long a session lives without being used — Auth.js's own default `maxAge`,
 * which `auth.ts` keeps. A row unseen for longer belongs to a cookie that has
 * expired, so it's no longer listed (and the background jobs clear it out).
 */
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Last-seen is a hint, not a request log: write it at most this often. */
export const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

/** Longest user agent kept — a header is caller-controlled and can be arbitrarily long. */
export const MAX_USER_AGENT_LENGTH = 400;

/** Whether a session can still be used: not revoked and not expired. */
export function isSessionActive(session: Pick<UserSession, "revokedAt" | "lastSeenAt">, now: Date): boolean {
  return session.revokedAt === null && now.getTime() - session.lastSeenAt.getTime() < SESSION_MAX_AGE_MS;
}

/** The result of checking a session on a request. */
export type SessionCheck = {
  userId: string;
};

export type DeviceKind = "mobile" | "tablet" | "desktop" | "unknown";

/** A user agent boiled down to what a person recognises: browser, system, kind of device. */
export type DeviceDescription = {
  browser: string | null;
  os: string | null;
  kind: DeviceKind;
};

/** Ordered: Edge and Opera announce Chrome too, Chrome announces Safari. First match wins. */
const BROWSERS: readonly (readonly [RegExp, string])[] = [
  [/Edg(e|A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/CriOS\/|Chrome\//, "Chrome"],
  [/Safari\//, "Safari"],
];

const SYSTEMS: readonly (readonly [RegExp, string])[] = [
  [/iPhone|iPad|iPod/, "iOS"],
  [/Android/, "Android"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/CrOS/, "ChromeOS"],
  [/Linux/, "Linux"],
];

/**
 * Describe a user agent for the sessions list. Deliberately coarse — browser and
 * system names, no versions: enough for someone to tell their phone from the
 * counter's laptop, without pretending to a precision user agents don't have.
 */
export function describeUserAgent(userAgent: string | null): DeviceDescription {
  if (!userAgent) return { browser: null, os: null, kind: "unknown" };
  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null;
  const os = SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null;
  const kind: DeviceKind = /iPad|Tablet/.test(userAgent)
    ? "tablet"
    : /Mobi|iPhone|Android/.test(userAgent)
      ? "mobile"
      : browser || os
        ? "desktop"
        : "unknown";
  return { browser, os, kind };
}
