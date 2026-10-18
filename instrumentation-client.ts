import * as Sentry from "@sentry/nextjs";

import { sentryBaseOptions } from "@/src/lib/observability/sentryOptions";

// Browser instrumentation (Next.js file convention — runs before hydration).
// `NEXT_PUBLIC_*` vars are inlined at build time, so the DSN must be present
// when the image is built (see the Dockerfile). No DSN → disabled.
Sentry.init(
  sentryBaseOptions({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
    tracesSampleRate: process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
  }),
);

/** Navigation spans/breadcrumbs for App Router transitions. */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
