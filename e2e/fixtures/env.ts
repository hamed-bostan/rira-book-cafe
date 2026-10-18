import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * The environment the E2E server (`next build` + `next start`) runs in. Every value
 * is a throwaway for tests: the database is the test container (its name must
 * contain "test", see `tests/fixtures/test-env.ts`), sign-in is the mock OTP, and
 * the Auth.js secret below signs nothing but these runs' cookies.
 */
export const E2E_PORT = Number(process.env.E2E_PORT ?? 3200);
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgresql://rira:testpassword@localhost:5546/rira_e2e_test";

/** Test-only signing secret; the global setup mints session cookies with it. */
export const E2E_AUTH_SECRET = "e2e-only-auth-secret-never-used-outside-playwright-runs";

export const E2E_UPLOADS_DIR = process.env.E2E_UPLOADS_DIR ?? join(tmpdir(), "rira-e2e-uploads");

export const E2E_SERVER_ENV: Record<string, string> = {
  DATABASE_URL: E2E_DATABASE_URL,
  AUTH_SECRET: E2E_AUTH_SECRET,
  AUTH_URL: E2E_BASE_URL,
  APP_URL: E2E_BASE_URL,
  NEXT_PUBLIC_SITE_URL: E2E_BASE_URL,
  API_BASE_URL: `${E2E_BASE_URL}/api`,
  OTP_MOCK: "true",
  ADMIN_USER_IDS: "",
  SMS_IR_API_KEY: "",
  SMTP_HOST: "",
  ZARINPAL_SANDBOX: "true",
  UPLOADS_DIR: E2E_UPLOADS_DIR,
};
