import type { UserRole } from "@/src/domain/entities/User";

/**
 * The accounts every integration and E2E run starts with, one per role that
 * matters. They're test values only: sign-in is the mock OTP (`OTP_MOCK=true`),
 * which shows the code on the verify screen, so there are no passwords anywhere.
 *
 * The id is the normalized phone, the same id a real sign-in would mint.
 */
export type TestUser = { id: string; phone: string; name: string; role: UserRole };

export const TEST_USERS = {
  owner: { id: "09120000001", phone: "09120000001", name: "Test Owner", role: "owner" },
  admin: { id: "09120000002", phone: "09120000002", name: "Test Admin", role: "admin" },
  staff: { id: "09120000003", phone: "09120000003", name: "Test Staff", role: "staff" },
  customer: { id: "09120000004", phone: "09120000004", name: "Test Guest", role: "customer" },
} as const satisfies Record<string, TestUser>;

export type TestUserKey = keyof typeof TEST_USERS;
