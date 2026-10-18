import * as Sentry from "@sentry/nextjs";

/**
 * Runs once per server instance, before it takes requests (Next.js file convention).
 *
 * 1. Validates the environment (`src/lib/env.ts`): a missing or malformed variable
 *    throws here, so the server refuses to start rather than half-working — and
 *    configurations that run but shouldn't in production are logged loudly.
 * 2. Boots the error tracker for whichever runtime this instance is.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { envWarnings, getEnv } = await import("./src/lib/env");
    const env = getEnv();
    for (const warning of envWarnings(env)) console.warn(`[env] ${warning}`);
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") await import("./sentry.edge.config");
}

/** Errors Next.js catches itself (render, route handler, server action, proxy). */
export const onRequestError = Sentry.captureRequestError;
