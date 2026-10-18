/**
 * Runs once when a server instance boots, before it takes requests.
 *
 * Validates the environment (`src/lib/env.ts`): a missing or malformed variable
 * throws here, so the server refuses to start rather than half-working — and
 * configurations that run but shouldn't in production are logged loudly.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { envWarnings, getEnv } = await import("./src/lib/env");
  const env = getEnv();
  for (const warning of envWarnings(env)) console.warn(`[env] ${warning}`);
}
