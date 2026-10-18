import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

import { TEST_DATABASE_URL } from "./tests/fixtures/test-env";

/**
 * Integration tests (`npm run test:integration`): route handlers + use-cases +
 * Prisma repositories against a real, throwaway Postgres (`npm run db:test:up`, or
 * CI's service container via `TEST_DATABASE_URL`).
 *
 * The files share one database, so they run one at a time; `setup.ts` resets and
 * re-seeds it before every test.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.integration.test.ts"],
    globalSetup: ["tests/integration/global-setup.ts"],
    setupFiles: ["tests/integration/setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      NODE_ENV: "test",
      // Mock OTP, no SMS/SMTP, sandbox payments, no break-glass owners: the
      // database roles alone decide access.
      OTP_MOCK: "true",
      SMS_IR_API_KEY: "",
      SMTP_HOST: "",
      ADMIN_USER_IDS: "",
      ZARINPAL_SANDBOX: "true",
      ZARINPAL_MERCHANT_ID: "",
      // Uploaded images go to a scratch folder, never ./storage.
      UPLOADS_DIR: mkdtempSync(join(tmpdir(), "rira-uploads-")),
    },
  },
});
