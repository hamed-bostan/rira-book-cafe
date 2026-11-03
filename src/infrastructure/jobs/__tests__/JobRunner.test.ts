import { describe, expect, it, vi } from "vitest";

import type { ILogger } from "@/src/domain/repositories/ILogger";

import { JobRunner, type BackgroundJob, type JobLock } from "../JobRunner";

function fakeLogger(): ILogger & { error: ReturnType<typeof vi.fn> } {
  const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: (): ILogger => logger };
  return logger;
}

const freeLock: JobLock = { runExclusive: async (work) => (await work(), true) };
const takenLock: JobLock = { runExclusive: async () => false };
const NOW = new Date("2026-11-04T14:30:00Z");

function job(
  name: string,
  run: (now: Date) => Promise<number> = async () => 0,
): BackgroundJob & { run: ReturnType<typeof vi.fn> } {
  return { name, run: vi.fn(run) };
}

describe("JobRunner", () => {
  it("runs every job in order, each at the clock's now", async () => {
    const order: string[] = [];
    const jobs = ["expire", "remind"].map((name) =>
      job(name, async () => {
        order.push(name);
        return 1;
      }),
    );
    await new JobRunner(jobs, freeLock, fakeLogger(), () => NOW).runOnce();
    expect(order).toEqual(["expire", "remind"]);
    expect(jobs[0].run).toHaveBeenCalledWith(NOW);
  });

  it("runs nothing while another instance holds the lock", async () => {
    const jobs = [job("expire")];
    await new JobRunner(jobs, takenLock, fakeLogger()).runOnce();
    expect(jobs[0].run).not.toHaveBeenCalled();
  });

  it("logs a failing job and still runs the next", async () => {
    const logger = fakeLogger();
    const failure = new Error("database hiccup");
    const jobs = [
      job("expire", async () => {
        throw failure;
      }),
      job("remind"),
    ];
    await new JobRunner(jobs, freeLock, logger).runOnce();
    expect(logger.error).toHaveBeenCalledWith("Background job failed", { error: failure, job: "expire" });
    expect(jobs[1].run).toHaveBeenCalled();
  });

  it("never throws, even when the lock does", async () => {
    const logger = fakeLogger();
    const broken: JobLock = { runExclusive: () => Promise.reject(new Error("no connection")) };
    await expect(new JobRunner([job("expire")], broken, logger).runOnce()).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith("Background job run failed", expect.anything());
  });

  it("skips a tick while this process's last run is still going", async () => {
    let finish = (): void => undefined;
    const slow = job("slow", () => new Promise<number>((resolve) => (finish = () => resolve(0))));
    const runner = new JobRunner([slow], freeLock, fakeLogger());
    const first = runner.runOnce();
    await runner.runOnce();
    finish();
    await first;
    expect(slow.run).toHaveBeenCalledTimes(1);
  });

  it("ticks on its interval once started, and stops", async () => {
    vi.useFakeTimers();
    try {
      const tick = job("tick");
      const runner = new JobRunner([tick], freeLock, fakeLogger());
      runner.start(5 * 60 * 1000, 1000);
      await vi.advanceTimersByTimeAsync(1000);
      expect(tick.run).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
      expect(tick.run).toHaveBeenCalledTimes(2);
      runner.stop();
      await vi.advanceTimersByTimeAsync(15 * 60 * 1000);
      expect(tick.run).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
