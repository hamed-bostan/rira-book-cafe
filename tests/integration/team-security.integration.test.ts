import { describe, expect, it, vi } from "vitest";

import { GET as exportActivity } from "@/app/api/admin/activity/export/route";
import { GET as readActivity } from "@/app/api/admin/activity/route";
import { GET as readShifts, POST as openShift } from "@/app/api/admin/cash-shifts/route";
import { GET as readMe } from "@/app/api/admin/me/route";
import { DELETE as revokeOtherSessions, GET as mySessions } from "@/app/api/admin/me/sessions/route";
import { DELETE as deleteRole, PUT as updateRole } from "@/app/api/admin/roles/[key]/route";
import { GET as listRoles, POST as createRole } from "@/app/api/admin/roles/route";
import { POST as createSupplier } from "@/app/api/admin/suppliers/route";
import { DELETE as revokeAccess, PUT as changeRole } from "@/app/api/admin/team/[id]/route";
import { DELETE as revokeMemberSessions, GET as memberSessions } from "@/app/api/admin/team/[id]/sessions/route";
import { POST as grantAccess } from "@/app/api/admin/team/route";
import { GET as readSettings, PUT as updateSettings } from "@/app/api/admin/team-settings/route";
import { PruneActivityLog } from "@/src/domain/use-cases/jobs/PruneActivityLog";
import { activityLog, teamSettingsRepository } from "@/src/infrastructure/container";
import { prisma } from "@/src/infrastructure/prisma/client";

import { TEST_USERS, testSessionId } from "../fixtures/users";

import { getRequest, jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs, signInAsUser } from "./helpers/session";

// The grant's invitation link is built from the request host; a direct call has none.
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "cafe.test" }) }));

type RoleBody = { key: string; builtIn: boolean; permissions: string[]; memberCount: number };

async function newRole(permissions: string[], nameEn = "Barista", nameFa = "باریستا"): Promise<Response> {
  signInAs("owner");
  return createRole(jsonRequest("POST", "/api/admin/roles", { nameEn, nameFa, permissions }));
}

describe("roles", () => {
  it("lists the built-in roles with today's permissions and who holds them", async () => {
    signInAs("owner");
    const roles = await readJson<RoleBody[]>(await listRoles());
    expect(roles.map((role) => role.key)).toEqual(["support", "staff", "admin"]);
    expect(roles.find((role) => role.key === "staff")).toMatchObject({ builtIn: true, memberCount: 1 });
    expect(roles.find((role) => role.key === "support")?.permissions).toEqual([
      "dashboard.view",
      "orders.note",
      "activity.view",
    ]);
  });

  it("is the owner's alone", async () => {
    signInAs("admin");
    expect((await listRoles()).status).toBe(401);
    const created = await createRole(
      jsonRequest("POST", "/api/admin/roles", { nameEn: "X", nameFa: "ایکس", permissions: [] }),
    );
    expect(created.status).toBe(401);
  });

  it("creates a custom role that a grant can give, whose permissions apply at once, and records it", async () => {
    const created = await newRole(["shifts.manage"]);
    expect(created.status).toBe(201);
    const role = await readJson<RoleBody>(created);
    expect(role.permissions).toEqual(["dashboard.view", "shifts.manage"]);

    const granted = await grantAccess(
      jsonRequest("POST", "/api/admin/team", { phone: "09120000077", email: "", role: role.key }),
    );
    expect(granted.status).toBe(201);
    expect((await prisma.user.findUnique({ where: { id: "09120000077" } }))?.role).toBe(role.key);

    // The custom role holds shifts.manage and nothing about orders.
    signInAsUser({ id: "09120000077", name: "Barista" });
    expect((await readShifts()).status).toBe(200);
    expect((await readActivity(getRequest("/api/admin/activity"))).status).toBe(401);
    const me = await readJson<{ role: string; roleName: { en: string } }>(await readMe());
    expect(me).toMatchObject({ role: role.key, roleName: { en: "Barista" } });

    const entry = await prisma.activityEntry.findFirst({ where: { action: "user.roleCreated" } });
    expect(entry).toMatchObject({ entityType: "user", entityId: role.key, entityLabel: "Barista / باریستا" });
  });

  it("edits a built-in role's permissions, effective on the next request", async () => {
    signInAs("staff");
    expect((await readActivity(getRequest("/api/admin/activity"))).status).toBe(200);

    signInAs("owner");
    const response = await updateRole(
      jsonRequest("PUT", "/api/admin/roles/staff", { permissions: ["orders.fulfill"] }),
      routeParams({ key: "staff" }),
    );
    expect(response.status).toBe(200);

    signInAs("staff");
    expect((await readActivity(getRequest("/api/admin/activity"))).status).toBe(401);
    expect(await prisma.activityEntry.count({ where: { action: "user.roleUpdated", entityId: "staff" } })).toBe(1);
  });

  it("never gives a role team management", async () => {
    const created = await newRole(["team.manage"]);
    expect(created.status).toBe(400);
    signInAs("owner");
    const edited = await updateRole(
      jsonRequest("PUT", "/api/admin/roles/admin", { permissions: ["team.manage"] }),
      routeParams({ key: "admin" }),
    );
    expect(edited.status).toBe(400);
    // And the owner role isn't addressable at all.
    const owner = await updateRole(
      jsonRequest("PUT", "/api/admin/roles/owner", { permissions: [] }),
      routeParams({ key: "owner" }),
    );
    expect(owner.status).toBe(404);
  });

  it("refuses deleting a role someone holds, and deletes it once nobody does", async () => {
    const role = await readJson<RoleBody>(await newRole(["orders.note"]));
    signInAs("owner");
    await changeRole(
      jsonRequest("PUT", `/api/admin/team/${TEST_USERS.staff.id}`, { role: role.key }),
      routeParams({ id: TEST_USERS.staff.id }),
    );

    const refused = await deleteRole(new Request("http://x"), routeParams({ key: role.key }));
    expect(refused.status).toBe(409);
    expect((await readError(refused)).code).toBe("ROLE_IN_USE");

    await changeRole(
      jsonRequest("PUT", `/api/admin/team/${TEST_USERS.staff.id}`, { role: "staff" }),
      routeParams({ id: TEST_USERS.staff.id }),
    );
    expect((await deleteRole(new Request("http://x"), routeParams({ key: role.key }))).status).toBe(204);
    expect(await prisma.role.findUnique({ where: { key: role.key } })).toBeNull();

    const builtIn = await deleteRole(new Request("http://x"), routeParams({ key: "admin" }));
    expect((await readError(builtIn)).code).toBe("ROLE_BUILT_IN");
  });
});

describe("sessions", () => {
  it("lists your own sessions with this browser marked, and signs out the others", async () => {
    await prisma.userSession.create({
      data: { id: "staff-phone", userId: TEST_USERS.staff.id, userAgent: "Mozilla/5.0 (iPhone) Safari/604.1" },
    });
    signInAs("staff");
    const sessions = await readJson<{ id: string; current: boolean }[]>(await mySessions());
    expect(sessions.map((session) => [session.id, session.current]).sort()).toEqual([
      [testSessionId("staff"), true],
      ["staff-phone", false],
    ]);

    expect(await readJson<{ revoked: number }>(await revokeOtherSessions())).toEqual({ revoked: 1 });
    expect((await prisma.userSession.findUnique({ where: { id: "staff-phone" } }))?.revokedAt).not.toBeNull();
    expect((await prisma.userSession.findUnique({ where: { id: testSessionId("staff") } }))?.revokedAt).toBeNull();
    // Your own sign-outs aren't team changes.
    expect(await prisma.activityEntry.count({ where: { action: "user.sessionsRevoked" } })).toBe(0);
  });

  it("lets the owner see and end a member's sessions, recorded", async () => {
    signInAs("owner");
    const listed = await readJson<{ id: string }[]>(
      await memberSessions(new Request("http://x"), routeParams({ id: TEST_USERS.staff.id })),
    );
    expect(listed.map((session) => session.id)).toEqual([testSessionId("staff")]);

    await revokeMemberSessions(new Request("http://x"), routeParams({ id: TEST_USERS.staff.id }));
    expect((await prisma.userSession.findUnique({ where: { id: testSessionId("staff") } }))?.revokedAt).not.toBeNull();
    expect(
      await prisma.activityEntry.count({ where: { action: "user.sessionsRevoked", entityId: TEST_USERS.staff.id } }),
    ).toBe(1);

    // A guest isn't on the team.
    expect((await memberSessions(new Request("http://x"), routeParams({ id: TEST_USERS.customer.id }))).status).toBe(
      404,
    );
  });

  it("ends every session of someone whose access is removed or whose role changes", async () => {
    signInAs("owner");
    await changeRole(
      jsonRequest("PUT", `/api/admin/team/${TEST_USERS.staff.id}`, { role: "support" }),
      routeParams({ id: TEST_USERS.staff.id }),
    );
    expect((await prisma.userSession.findUnique({ where: { id: testSessionId("staff") } }))?.revokedAt).not.toBeNull();

    await revokeAccess(new Request("http://x"), routeParams({ id: TEST_USERS.admin.id }));
    expect((await prisma.userSession.findUnique({ where: { id: testSessionId("admin") } }))?.revokedAt).not.toBeNull();
  });
});

describe("team settings", () => {
  it("are the owner's alone, and record a change of retention", async () => {
    signInAs("admin");
    expect((await readSettings()).status).toBe(401);

    signInAs("owner");
    expect(await readJson(await readSettings())).toEqual({ activityRetentionMonths: null });
    const saved = await updateSettings(jsonRequest("PUT", "/x", { activityRetentionMonths: 24 }));
    expect(await readJson(saved)).toEqual({ activityRetentionMonths: 24 });
    expect(await prisma.activityEntry.count({ where: { action: "user.securitySettingsChanged" } })).toBe(1);

    // Saving what's already set records nothing.
    await updateSettings(jsonRequest("PUT", "/x", { activityRetentionMonths: 24 }));
    expect(await prisma.activityEntry.count({ where: { action: "user.securitySettingsChanged" } })).toBe(1);
  });
});

describe("activity log", () => {
  it("filters by action, day span and text, and exports only what the reader may see", async () => {
    signInAs("owner");
    await createSupplier(
      jsonRequest("POST", "/api/admin/suppliers", { name: "Lamiz Roastery", phone: "", note: "", isActive: true }),
    );
    await newRole(["orders.note"], "Greeter", "خوشامدگو");

    signInAs("owner");
    const byAction = await readJson<{ items: { action: string }[] }>(
      await readActivity(getRequest("/api/admin/activity?action=expense.supplierCreated")),
    );
    expect(byAction.items.map((entry) => entry.action)).toEqual(["expense.supplierCreated"]);

    const bySearch = await readJson<{ items: { entityLabel?: string }[] }>(
      await readActivity(getRequest("/api/admin/activity?q=lamiz")),
    );
    expect(bySearch.items.map((entry) => entry.entityLabel)).toEqual(["Lamiz Roastery"]);

    const past = await readJson<{ total: number }>(
      await readActivity(getRequest("/api/admin/activity?from=2020-01-01&to=2020-01-31")),
    );
    expect(past.total).toBe(0);

    const ownerCsv = await (await exportActivity(getRequest("/api/admin/activity/export?locale=en"))).text();
    expect(ownerCsv).toContain("Lamiz Roastery");
    expect(ownerCsv).toContain("Greeter / خوشامدگو");

    // Staff read neither the books nor the team's changes.
    signInAs("staff");
    const staffCsv = await (await exportActivity(getRequest("/api/admin/activity/export?locale=fa"))).text();
    expect(staffCsv).not.toContain("Lamiz Roastery");
    expect(staffCsv).not.toContain("Greeter");
    expect(staffCsv.split("\r\n")[0]).toContain("زمان (تهران)");
  });

  it("still reads entries whose action this version no longer records", async () => {
    // A removed feature's entries stay in the log; they read as `unknown` rather
    // than failing the page.
    await prisma.activityEntry.create({
      data: {
        actorId: TEST_USERS.owner.id,
        actorName: TEST_USERS.owner.name,
        action: "user.someRetiredAction",
        entityType: "user",
        entityId: TEST_USERS.staff.id,
        changes: [{ field: "retiredField", before: "on", after: "off" }],
        changedFields: ["retiredField"],
      },
    });
    signInAs("owner");
    const response = await readActivity(getRequest("/api/admin/activity?entityType=user"));
    expect(response.status).toBe(200);
    const page = await readJson<{ items: { action: string; entityType: string }[] }>(response);
    expect(page.items).toEqual([expect.objectContaining({ action: "unknown", entityType: "user" })]);
  });

  it("logs till shifts opening", async () => {
    signInAs("staff");
    await openShift(jsonRequest("POST", "/api/admin/cash-shifts", { openingFloat: 500_000 }));
    expect(await prisma.activityEntry.findFirst({ where: { action: "cashShift.opened" } })).toMatchObject({
      entityType: "cashShift",
      actorId: TEST_USERS.staff.id,
    });
  });

  it("prunes entries past the retention period in batches, and logs the prune", async () => {
    signInAs("owner");
    await createSupplier(
      jsonRequest("POST", "/api/admin/suppliers", { name: "Old Supplier", phone: "", note: "", isActive: true }),
    );
    await prisma.activityEntry.updateMany({ data: { createdAt: new Date("2024-01-01T00:00:00Z") } });
    await createSupplier(
      jsonRequest("POST", "/api/admin/suppliers", { name: "New Supplier", phone: "", note: "", isActive: true }),
    );

    const job = new PruneActivityLog(activityLog, teamSettingsRepository);
    expect(await job.execute(new Date())).toBe(0); // forever by default

    await updateSettings(jsonRequest("PUT", "/x", { activityRetentionMonths: 12 }));
    expect(await job.execute(new Date())).toBe(1);
    const left = await prisma.activityEntry.findMany({ select: { action: true, entityLabel: true } });
    expect(left).toEqual(
      expect.arrayContaining([
        { action: "expense.supplierCreated", entityLabel: "New Supplier" },
        { action: "activity.pruned", entityLabel: null },
      ]),
    );
    expect(left.some((entry) => entry.entityLabel === "Old Supplier")).toBe(false);
  });
});
