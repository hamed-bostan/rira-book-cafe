import { sentryBaseOptions } from "@/src/lib/observability/sentryOptions";

import type * as SentrySdk from "@sentry/nextjs";

// Browser instrumentation (Next.js file convention — runs before hydration).
// `NEXT_PUBLIC_*` vars are inlined at build time, so the DSN must be present
// when the image is built (see the Dockerfile). No DSN → disabled.
//
// The SDK is ~57 kB gzip, so it stays off the critical path:
// - without a DSN, `DSN` is inlined as `undefined` and the bundler drops the
//   `import()` below entirely — the browser downloads none of it;
// - with a DSN, it loads in its own chunk once the page is idle, after hydration.
//   An error thrown before then is missed client-side; the server SDK still
//   reports render and route-handler failures.
const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

let sentry: typeof SentrySdk | undefined;

if (DSN && typeof window !== "undefined") {
  const load = (): void => {
    void import("@sentry/nextjs").then((module) => {
      module.init(
        sentryBaseOptions({
          dsn: DSN,
          environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
          tracesSampleRate: process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
        }),
      );
      sentry = module;
    });
  };
  if ("requestIdleCallback" in window) window.requestIdleCallback(load, { timeout: 5_000 });
  else setTimeout(load, 2_000);
}

/** Navigation spans/breadcrumbs for App Router transitions, once the SDK has loaded. */
export function onRouterTransitionStart(href: string, navigationType: string): void {
  sentry?.captureRouterTransitionStart(href, navigationType);
}
