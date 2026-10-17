import * as Sentry from "@sentry/nextjs";

/**
 * Server instrumentation (Next.js file convention — runs once per server
 * instance, before the first request). Boots the error tracker for whichever
 * runtime this instance is.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("./sentry.edge.config");
}

/** Errors Next.js catches itself (render, route handler, server action, proxy). */
export const onRequestError = Sentry.captureRequestError;
