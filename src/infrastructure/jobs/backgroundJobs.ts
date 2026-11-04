import { ExpireBookHolds } from "@/src/domain/use-cases/jobs/ExpireBookHolds";
import { ExpireLoyaltyPoints } from "@/src/domain/use-cases/jobs/ExpireLoyaltyPoints";
import { ExpireSuiteRequests, ExpireTableRequests } from "@/src/domain/use-cases/jobs/ExpireRequests";
import { PruneActivityLog, PruneSessions } from "@/src/domain/use-cases/jobs/PruneActivityLog";
import {
  SendEventReminders,
  SendHoldReminders,
  SendLoanReminders,
  SendSuiteReminders,
  SendTableReminders,
} from "@/src/domain/use-cases/jobs/SendReminders";
import {
  activityLog,
  bookLoanRepository,
  bookWaitlistRepository,
  customerNotifier,
  eventRepository,
  logger,
  loyaltyRepository,
  reservationRepository,
  sessionRepository,
  suiteBookingRepository,
  teamSettingsRepository,
} from "@/src/infrastructure/container";

import { JobRunner, type BackgroundJob } from "./JobRunner";
import { PostgresJobLock } from "./PostgresJobLock";

/** The advisory lock every instance's runs share. */
const JOBS_LOCK_KEY = "rira:background-jobs";

/**
 * Every background job, in the order a run takes them: the expiries first — a
 * skipped hold passes its copy on, so the next guest's "collect it by …" goes out
 * in the same run — then the reminders.
 */
export function createBackgroundJobs(): BackgroundJob[] {
  const useCases = {
    expireTableRequests: new ExpireTableRequests(reservationRepository, customerNotifier),
    expireSuiteRequests: new ExpireSuiteRequests(suiteBookingRepository, customerNotifier),
    expireBookHolds: new ExpireBookHolds(bookWaitlistRepository, customerNotifier),
    // Off unless the owner set a points expiry in the loyalty settings.
    expireLoyaltyPoints: new ExpireLoyaltyPoints(loyaltyRepository, customerNotifier),
    tableReminders: new SendTableReminders(reservationRepository, customerNotifier),
    suiteReminders: new SendSuiteReminders(suiteBookingRepository, customerNotifier),
    eventReminders: new SendEventReminders(eventRepository, customerNotifier),
    loanReminders: new SendLoanReminders(bookLoanRepository, customerNotifier),
    holdReminders: new SendHoldReminders(bookWaitlistRepository, customerNotifier),
    // Housekeeping last: the owner's activity retention (a no-op while it's
    // "forever"), then session rows nobody can use any more.
    pruneActivityLog: new PruneActivityLog(activityLog, teamSettingsRepository),
    pruneSessions: new PruneSessions(sessionRepository),
  };
  return Object.entries(useCases).map(([name, useCase]) => ({ name, run: (now) => useCase.execute(now) }));
}

const registry = globalThis as typeof globalThis & { __jobRunner?: JobRunner };

/**
 * Start running the jobs every `intervalMinutes` in this process — from
 * `instrumentation.ts`, once per server instance. Anchored to `globalThis`, so a
 * second call (dev re-evaluating the module) doesn't start a second timer.
 */
export function startJobRunner(intervalMinutes: number): void {
  if (registry.__jobRunner) return;
  const intervalMs = intervalMinutes * 60 * 1000;
  const jobLogger = logger.child({ module: "jobs" });
  const runner = new JobRunner(createBackgroundJobs(), new PostgresJobLock(JOBS_LOCK_KEY, intervalMs), jobLogger);
  registry.__jobRunner = runner;
  runner.start(intervalMs);
  jobLogger.info("Background jobs started", { intervalMinutes });
}
