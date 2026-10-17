import * as Sentry from "@sentry/nextjs";

import { sentryBaseOptions } from "@/src/lib/observability/sentryOptions";

// Node.js runtime (route handlers, Server Components, the proxy). Loaded from
// `instrumentation.ts`. No `SENTRY_DSN` → disabled, nothing is sent.
Sentry.init(
  sentryBaseOptions({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT,
    tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE,
  }),
);
