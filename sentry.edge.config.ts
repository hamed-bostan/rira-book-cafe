import * as Sentry from "@sentry/nextjs";

import { sentryBaseOptions } from "@/src/lib/observability/sentryOptions";

// Edge runtime. Nothing runs on the edge today (the proxy is Node-only in Next 16),
// but any future `runtime = "edge"` route is covered. Loaded from `instrumentation.ts`.
Sentry.init(
  sentryBaseOptions({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT,
    tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE,
  }),
);
