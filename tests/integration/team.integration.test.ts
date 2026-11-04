import { describe, expect, it, vi } from "vitest";

import { POST as grantAccess } from "@/app/api/admin/team/route";
import { prisma } from "@/src/infrastructure/prisma/client";

import { TEST_USERS } from "../fixtures/users";

import { jsonRequest, readError, readJson } from "./helpers/http";
import { signInAs } from "./helpers/session";

// The invitation links to this deployment's sign-in page, resolved from the
// request's host — which a handler called directly has no request scope to read.
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "cafe.test" }) }));

async function grant(phone: string, role: string): Promise<Response> {
  signInAs("owner");
  return grantAccess(jsonRequest("POST", "/api/admin/team", { phone, email: "", role }));
}

async function roleOf(id: string): Promise<string | undefined> {
  return (await prisma.user.findUnique({ where: { id }, select: { role: true } }))?.role;
}

describe("granting dashboard access", () => {
  it("brings someone new onto the team", async () => {
    const response = await grant("0912 000 0099", "staff");
    expect(response.status).toBe(201);
    expect(await readJson<{ role: string }>(response)).toMatchObject({ role: "staff" });
    expect(await roleOf("09120000099")).toBe("staff");
  });

  it("won't let the owner grant a role to their own number and demote themself", async () => {
    const response = await grant(TEST_USERS.owner.phone, "admin");
    expect(response.status).toBe(409);
    expect((await readError(response)).code).toBe("REVOKE_SELF");
    expect(await roleOf(TEST_USERS.owner.id)).toBe("owner");
  });

  it("sends a member in another role to the role change instead", async () => {
    const response = await grant(TEST_USERS.staff.phone, "admin");
    expect(response.status).toBe(409);
    expect((await readError(response)).code).toBe("ALREADY_ON_TEAM");
    expect(await roleOf(TEST_USERS.staff.id)).toBe("staff");
  });

  it("is still a no-op for a member granted the role they hold", async () => {
    const response = await grant(TEST_USERS.staff.phone, "staff");
    expect(response.status).toBe(201);
    expect(await roleOf(TEST_USERS.staff.id)).toBe("staff");
    expect(await prisma.activityEntry.count({ where: { entityId: TEST_USERS.staff.id } })).toBe(0);
  });
});
