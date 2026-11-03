import type { ILogger } from "@/src/domain/repositories/ILogger";

/** One job the runner works through: a name for the logs, and the use-case it runs at `now`. */
export type BackgroundJob = {
  name: string;
  /** Resolves to how many things were due (sent now or before, or changed). */
  run(now: Date): Promise<number>;
};

/**
 * Lets one run happen at a time, across every server instance and overlapping
 * ticks. `runExclusive` resolves `false` without running `work` when another run
 * holds the lock.
 */
export type JobLock = {
  runExclusive(work: () => Promise<void>): Promise<boolean>;
};

/** The first run waits this long after boot, so the server is taking requests first. */
const FIRST_RUN_DELAY_MS = 30_000;

/**
 * Runs the background jobs every few minutes inside the server process — there's
 * no separate scheduler; the app is one container. Each run takes the lock, then
 * works through the jobs in order. Nothing here throws: a failing job is logged
 * (and so reported to the error tracker) and the next one still runs, and a run
 * that fails as a whole leaves the timer going for the next.
 */
export class JobRunner {
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;

  constructor(
    private readonly jobs: readonly BackgroundJob[],
    private readonly lock: JobLock,
    private readonly logger: ILogger,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /** Run every `intervalMs`, the first time shortly after boot. Starting twice does nothing. */
  start(intervalMs: number, firstRunAfterMs: number = FIRST_RUN_DELAY_MS): void {
    if (this.timer) return;
    // Unref'd: the timers never keep a stopping process alive.
    this.timer = setInterval(() => void this.runOnce(), intervalMs);
    this.timer.unref();
    setTimeout(() => void this.runOnce(), firstRunAfterMs).unref();
  }

  stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  /** One run of every job, in order, under the lock. Skipped while this process's last run is still going. */
  async runOnce(): Promise<void> {
    if (this.running) {
      this.logger.warn("Background jobs are still running from the last tick; skipping this one");
      return;
    }
    this.running = true;
    try {
      const ran = await this.lock.runExclusive(async () => {
        for (const job of this.jobs) await this.runJob(job);
      });
      if (!ran) this.logger.debug("Background jobs are running on another instance; skipping this tick");
    } catch (error) {
      this.logger.error("Background job run failed", { error });
    } finally {
      this.running = false;
    }
  }

  private async runJob(job: BackgroundJob): Promise<void> {
    const started = Date.now();
    try {
      const count = await job.run(this.clock());
      this.logger.debug("Background job ran", { job: job.name, count, ms: Date.now() - started });
    } catch (error) {
      this.logger.error("Background job failed", { error, job: job.name });
    }
  }
}
