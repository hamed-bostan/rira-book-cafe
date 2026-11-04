import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { DELETE as revokeMySession } from "@/app/api/admin/me/sessions/[sessionId]/route";
import { GET as exportReport } from "@/app/api/admin/reports/export/[table]/route";
import { GET as guestReport } from "@/app/api/admin/reports/guests/route";
import { PUT as updateRole } from "@/app/api/admin/roles/[key]/route";
import { POST as createRole } from "@/app/api/admin/roles/route";
import { PUT as transferOwnership } from "@/app/api/admin/team/[id]/owner/route";
import { DELETE as revokeMemberSession } from "@/app/api/admin/team/[id]/sessions/[sessionId]/route";
import { prisma } from "@/src/infrastructure/prisma/client";
import { REPORT_TABLE_SLUGS } from "@/src/lib/api/report-csv";
import { roleResponseSchema } from "@/src/presentation/dashboard/team/security-response-schema";

import { TEST_USERS, testSessionId } from "../fixtures/users";

import { jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

/**
 * Insights and Store routes no other suite drives: signing one browser out (your
 * own, or a team member's), handing ownership over, the guests report, and every
 * report table's CSV.
 */

// The ownership notice links to the team page, built from the request's host.
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "cafe.test" }) }));

const DELETE = (): Request => new Request("http://x", { method: "DELETE" });

async function extraSession(userId: string, id: string): Promise<void> {
  await prisma.userSession.create({ data: { id, userId, userAgent: "Mozilla/5.0 (iPhone) Safari/604.1" } });
}

async function revokedAt(id: string): Promise<Date | null | undefined> {
  return (await prisma.userSession.findUnique({ where: { id } }))?.revokedAt;
}

describe("signing one browser out", () => {
  it("ends one of your own sessions, and only your own", async () => {
    await extraSession(TEST_USERS.staff.id, "staff-phone");
    await extraSession(TEST_USERS.admin.id, "admin-phone");
    signInAs("staff");

    expect((await revokeMySession(DELETE(), routeParams({ sessionId: "staff-phone" }))).status).toBe(204);
    expect(await revokedAt("staff-phone")).not.toBeNull();
    expect(await revokedAt(testSessionId("staff"))).toBeNull();

    // Someone else's session isn't yours to end: it's as if it didn't exist.
    expect((await revokeMySession(DELETE(), routeParams({ sessionId: "admin-phone" }))).status).toBe(404);
    expect(await revokedAt("admin-phone")).toBeNull();
  });

  it("lets the owner end one of a member's sessions, and nobody else", async () => {
    await extraSession(TEST_USERS.staff.id, "staff-phone");
    const end = (): Promise<Response> =>
      revokeMemberSession(DELETE(), routeParams({ id: TEST_USERS.staff.id, sessionId: "staff-phone" }));

    signInAs("admin");
    expect((await end()).status).toBe(401);
    expect(await revokedAt("staff-phone")).toBeNull();

    signInAs("owner");
    expect((await end()).status).toBe(204);
    expect(await revokedAt("staff-phone")).not.toBeNull();
    expect(await revokedAt(testSessionId("staff"))).toBeNull();
    expect(
      await prisma.activityEntry.count({ where: { action: "user.sessionsRevoked", entityId: TEST_USERS.staff.id } }),
    ).toBe(1);
  });
});

describe("handing ownership over", () => {
  const transfer = (id: string): Promise<Response> =>
    transferOwnership(new Request("http://x", { method: "PUT" }), routeParams({ id }));

  async function roleOf(id: string): Promise<string | undefined> {
    return (await prisma.user.findUnique({ where: { id } }))?.role;
  }

  it("swaps the owner and the new owner, recorded both ways", async () => {
    signInAs("owner");

    const response = await transfer(TEST_USERS.admin.id);

    expect(response.status).toBe(200);
    expect(await roleOf(TEST_USERS.admin.id)).toBe("owner");
    expect(await roleOf(TEST_USERS.owner.id)).toBe("admin");
    expect(await prisma.user.count({ where: { role: "owner" } })).toBe(1);
    expect(await prisma.activityEntry.count({ where: { action: "user.roleChanged" } })).toBe(2);
  });

  it("refuses the owner handing it to themselves (409), and anyone but the owner (401)", async () => {
    signInAs("owner");
    const self = await transfer(TEST_USERS.owner.id);
    expect(self.status).toBe(409);
    expect((await readError(self)).code).toBe("REVOKE_SELF");

    signInAs("admin");
    expect((await transfer(TEST_USERS.admin.id)).status).toBe(401);
    expect(await roleOf(TEST_USERS.owner.id)).toBe("owner");
  });
});

describe("editing a role", () => {
  it("answers with the role the editor expects, member count included", async () => {
    signInAs("owner");
    const created = await createRole(
      jsonRequest("POST", "/api/admin/roles", { nameEn: "Host", nameFa: "میزبان", permissions: ["dashboard.view"] }),
    );
    const { key } = await readJson<{ key: string }>(created);

    const edited = await updateRole(
      jsonRequest("PUT", `/api/admin/roles/${key}`, { nameEn: "Host desk", nameFa: "میز میزبان" }),
      routeParams({ key }),
    );
    expect(edited.status).toBe(200);
    // The role editor parses the answer with this schema; without the count it read as a failure.
    const parsed = roleResponseSchema.safeParse(await readJson(edited));
    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({ name: { en: "Host desk" }, memberCount: 0 });

    const staff = await updateRole(
      jsonRequest("PUT", "/api/admin/roles/staff", { permissions: ["dashboard.view", "orders.fulfill"] }),
      routeParams({ key: "staff" }),
    );
    expect(roleResponseSchema.parse(await readJson(staff)).memberCount).toBe(1);
  });
});

describe("the reports", () => {
  it("reads the guests report", async () => {
    signInAs("admin");

    const response = await guestReport(new NextRequest("http://x/api/admin/reports/guests?range=30d"));

    expect(response.status).toBe(200);
  });

  it.each(Object.values(REPORT_TABLE_SLUGS))("exports %s as CSV", async (slug) => {
    signInAs("admin");

    const response = await exportReport(
      new NextRequest(`http://x/api/admin/reports/export/${slug}?range=30d`),
      routeParams({ table: slug }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect((await response.text()).length).toBeGreaterThan(0);
  });

  it("answers 404 for a table that doesn't exist, and keeps floor staff out (401)", async () => {
    signInAs("admin");
    const unknown = await exportReport(
      new NextRequest("http://x/api/admin/reports/export/nope"),
      routeParams({ table: "nope" }),
    );
    expect(unknown.status).toBe(404);

    signInAs("staff");
    expect((await guestReport(new NextRequest("http://x/api/admin/reports/guests"))).status).toBe(401);
  });
});
