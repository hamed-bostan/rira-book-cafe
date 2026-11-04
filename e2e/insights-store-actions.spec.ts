import { expect, request, test, type APIRequestContext, type Page } from "@playwright/test";

import { E2E_BASE_URL } from "./fixtures/env";
import { jsonOf } from "./fixtures/responsive";
import { storageStatePath } from "./fixtures/sessions";

/**
 * Insights and Store clicks nothing else saves: a member's role changed and their
 * access removed, a custom role edited and deleted, a report table exported as CSV,
 * and the activity log's filters cleared.
 *
 * The team tests work on a member this spec adds: changing the seeded accounts'
 * roles would sign them out, and every later spec runs as one of them.
 */

const TAG = Math.random()
  .toString(36)
  .replace(/[^a-z]/g, "")
  .slice(0, 5);

async function ownerApi(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: E2E_BASE_URL, storageState: storageStatePath("owner") });
}

/** A toast's title (its live region repeats it with a prefix). */
function toast(page: Page, text: string | RegExp) {
  return page.getByText(text, typeof text === "string" ? { exact: true } : undefined).first();
}

/**
 * A toast that names someone or something: the name is bidi-isolated (an invisible
 * mark either side), so it's matched with room for those marks.
 */
function namedToast(page: Page, name: string, rest: string) {
  return toast(page, new RegExp(`${name}.{0,2} ${rest}`));
}

test.describe("as the owner", () => {
  test.use({ storageState: storageStatePath("owner") });

  test("a member's role is changed, then their access removed", async ({ page }) => {
    const api = await ownerApi();
    // A number no other spec uses; a rerun on a kept database finds it already there.
    const phone = "09120000566";
    const shown = "0912 000 0566";
    const granted = await api.post("/api/admin/team", { data: { phone, email: "", role: "staff" } });
    expect([201, 409]).toContain(granted.status());

    await page.goto("/dashboard/team");
    const member = page.getByRole("listitem", { name: shown });
    await member.getByRole("button", { name: `More actions for ${shown}` }).click();
    await page.getByRole("menuitem", { name: "Change role" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Role").selectOption("support");
    await dialog.getByRole("button", { name: "Save role" }).click();
    await expect(namedToast(page, shown, "is now Support")).toBeVisible();
    await expect(member).toContainText("Support");

    await member.getByRole("button", { name: `More actions for ${shown}` }).click();
    await page.getByRole("menuitem", { name: "Remove access" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Remove access" }).click();
    await expect(namedToast(page, shown, "no longer has access")).toBeVisible();
    await expect(page.getByRole("listitem", { name: shown })).toHaveCount(0);
    await api.dispose();
  });

  test("a custom role is edited, then deleted", async ({ page }) => {
    const api = await ownerApi();
    const name = `Host ${TAG}`;
    await jsonOf(
      await api.post("/api/admin/roles", {
        data: { nameEn: name, nameFa: "میزبان", permissions: ["dashboard.view", "reservations.manage"] },
      }),
    );

    await page.goto("/dashboard/team?tab=roles");
    const role = page.getByRole("listitem", { name });
    await role.getByRole("button", { name: "Edit" }).click();
    const dialog = page.getByRole("dialog");
    const renamed = `${name} desk`;
    await dialog.getByLabel("Name in English").fill(renamed);
    await dialog.getByRole("button", { name: "Save role" }).click();
    // Before the fix, a save that went through still showed "Something went wrong".
    // The toast names the role as it was opened.
    await expect(namedToast(page, name, "saved")).toBeVisible();
    await expect(dialog).toBeHidden();

    const saved = page.getByRole("listitem", { name: renamed });
    await saved.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(namedToast(page, renamed, "deleted")).toBeVisible();
    await expect(page.getByRole("listitem", { name: renamed })).toHaveCount(0);
    await api.dispose();
  });
});

test.describe("as an admin", () => {
  test.use({ storageState: storageStatePath("admin") });

  test("a report table is exported as CSV from the reports page", async ({ page }) => {
    await page.goto("/dashboard/reports");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: "Sales by day" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.csv$/);
    expect(await file.path()).toBeTruthy();
  });

  test("the activity log's filters are cleared", async ({ page }) => {
    await page.goto("/dashboard/activity?entityType=order&q=nothing-matches-this");
    await page.getByRole("link", { name: "Clear filters" }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/activity$/);
  });
});
