import type { IDatabaseProbe } from "../../repositories/IDatabaseProbe";

/** A probe slower than this counts as down: a health check must answer fast. */
export const DEFAULT_PROBE_TIMEOUT_MS = 2_000;

export type HealthStatus = "ok" | "error";

export type HealthReport = {
  status: HealthStatus;
  checks: {
    database: { status: HealthStatus; latencyMs: number };
  };
};

/**
 * Is the app able to serve requests? Pings each dependency the app can't work
 * without (today: the database) under a hard timeout, so an uptime monitor or the
 * container healthcheck gets a quick, honest answer even when the database hangs.
 * The report carries no error detail — it is served without auth.
 */
export class CheckHealth {
  constructor(
    private readonly database: IDatabaseProbe,
    private readonly timeoutMs: number = DEFAULT_PROBE_TIMEOUT_MS,
  ) {}

  async execute(): Promise<HealthReport> {
    const startedAt = Date.now();
    const databaseUp = await this.probe();
    const database = { status: databaseUp ? "ok" : "error", latencyMs: Date.now() - startedAt } as const;

    return { status: database.status, checks: { database } };
  }

  private async probe(): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Database probe timed out.")), this.timeoutMs);
    });

    try {
      await Promise.race([this.database.ping(), timeout]);
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
}
