import { defineConfig, devices } from "@playwright/test";

import { E2E_BASE_URL, E2E_PORT, E2E_SERVER_ENV } from "./e2e/fixtures/env";

const CI = Boolean(process.env.CI);

/**
 * End-to-end tests (`npm run test:e2e`): a handful of critical flows through a real
 * browser against a production build (`next build` + `next start` — never the dev
 * server) on a seeded test database (`npm run db:test:up` first locally).
 *
 * Set `E2E_SKIP_BUILD=1` to reuse an existing `.next` build (CI builds in a step
 * of its own so a build failure reads as one).
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // The flows share one database; running them one at a time keeps them independent.
  fullyParallel: false,
  workers: 1,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: CI ? [["list"], ["html", { open: "never" }], ["github"]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: E2E_BASE_URL,
    locale: "en-US",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      // `E2E_BROWSER_CHANNEL=msedge` (or `chrome`) drives an installed browser instead
      // of Playwright's bundled Chromium — for machines where `playwright install`
      // can't download it.
      use: { ...devices["Desktop Chrome"], channel: process.env.E2E_BROWSER_CHANNEL || undefined },
    },
  ],
  webServer: {
    // Fresh database, then the build, then the server. With `reuseExistingServer`
    // (local runs) an already-running server keeps its database as it is.
    command: [
      "npx tsx e2e/prepare-database.ts",
      ...(process.env.E2E_SKIP_BUILD ? [] : ["npm run build"]),
      `npx next start -p ${E2E_PORT}`,
    ].join(" && "),
    url: E2E_BASE_URL,
    env: E2E_SERVER_ENV,
    reuseExistingServer: !CI,
    timeout: 10 * 60_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
