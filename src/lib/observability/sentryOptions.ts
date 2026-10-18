import { scrubEvent } from "./scrubPii";

/**
 * Options shared by the server, edge and browser Sentry SDKs.
 *
 * Deliberately limited to the plain event protocol so a self-hosted GlitchTip
 * works with the same DSN as Sentry SaaS: errors and (optional, sampled)
 * transactions — no Session Replay, profiling or other SaaS-only products.
 *
 * Every value comes from env and is optional: without a DSN the SDK is disabled
 * and sends nothing. The browser can only see `NEXT_PUBLIC_*` vars, which Next
 * inlines at build time — so each runtime reads its own vars and passes them in.
 */
export type SentryEnv = {
  dsn: string | undefined;
  environment: string | undefined;
  tracesSampleRate: string | undefined;
};

export type SentryBaseOptions = {
  dsn: string | undefined;
  enabled: boolean;
  environment: string;
  tracesSampleRate: number;
  sendDefaultPii: false;
  beforeSend: typeof scrubEvent;
  beforeSendTransaction: typeof scrubEvent;
};

/** Parse a 0–1 sample rate; anything unset or invalid means tracing is off. */
export function parseSampleRate(raw: string | undefined): number {
  const rate = Number(raw);
  return Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : 0;
}

export function sentryBaseOptions(env: SentryEnv): SentryBaseOptions {
  const dsn = env.dsn?.trim() || undefined;
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: env.environment || process.env.NODE_ENV,
    tracesSampleRate: parseSampleRate(env.tracesSampleRate),
    // Never attach IPs, cookies or the signed-in user automatically — see scrubPii.
    sendDefaultPii: false,
    beforeSend: scrubEvent,
    beforeSendTransaction: scrubEvent,
  };
}
