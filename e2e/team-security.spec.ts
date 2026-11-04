import { expect, test, type Page } from "@playwright/test";

import { storageStatePath } from "./fixtures/sessions";

/** Sign in with the mock OTP (the code is shown on screen), landing on `callbackUrl`. */
async function signIn(page: Page, phone: string, callbackUrl: string): Promise<void> {
  await page.goto(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  await expect(async () => {
    await page.getByRole("textbox", { name: "Phone number" }).fill(phone);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/login\/verify/, { timeout: 3_000 });
  }).toPass();
  await page.getByRole("button", { name: /Dev code:/ }).click();
  await page.getByRole("button", { name: "Verify Code" }).click();
}

// Numbers this spec grants, so the shared test users' sessions stay untouched.
const MEMBER_PHONE = "09120000555";

test.describe.configure({ mode: "serial" });

test.describe("the owner's team page", () => {
  test.use({ storageState: storageStatePath("owner") });

  test("makes a custom role, which the grant picker then offers", async ({ page }) => {
    await page.goto("/dashboard/team?tab=roles");
    await expect(page.getByRole("heading", { name: "Roles" })).toBeVisible();

    await expect(async () => {
      await page.getByRole("button", { name: "New role" }).click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 2_000 });
    }).toPass();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name in English").fill("Barista");
    await dialog.getByLabel("Name in Persian").fill("باریستا");
    await dialog.getByRole("checkbox", { name: "Run till shifts" }).click();
    // Team management is never on the list.
    await expect(dialog.getByRole("checkbox", { name: "Manage the team" })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Create role" }).click();

    await expect(page.getByRole("listitem", { name: "Barista" })).toBeVisible();
    await expect(page.getByRole("listitem", { name: "Barista" })).toContainText("2 of 18 permissions");

    await page.getByRole("link", { name: "Members" }).click();
    await expect(page.locator("option", { hasText: "Barista" })).toHaveCount(1);

    // Grant the new role to a fresh number for the next test.
    await page.getByRole("textbox", { name: "Phone number" }).fill(MEMBER_PHONE);
    await page
      .locator("select")
      .filter({ has: page.locator("option", { hasText: "Barista" }) })
      .selectOption({
        label: "Barista",
      });
    await page.getByRole("button", { name: "Grant access" }).click();
    await expect(page.getByRole("listitem", { name: "0912 000 0555" })).toContainText("Barista");
  });

  test("links the access history to the activity log filtered to the team", async ({ page }) => {
    await page.goto("/dashboard/team");
    await page.getByRole("link", { name: "See all" }).click();
    await expect(page).toHaveURL(/\/dashboard\/activity\?entityType=user/);
    await expect(page.getByText(/created the role Barista/)).toBeVisible();
  });

  test("offers the security settings, saved as they're changed", async ({ page }) => {
    await page.goto("/dashboard/team?tab=security");
    const retention = page.getByLabel("Keep activity for");
    await expect(retention).toHaveValue("forever");
    // Selected once the page has hydrated (a change before that would be lost).
    await expect(async () => {
      await retention.selectOption({ label: "2 years" });
      await expect(page.getByText("Settings saved").first()).toBeVisible({ timeout: 3_000 });
    }).toPass();
    await page.reload();
    await expect(page.getByLabel("Keep activity for")).toHaveValue("24");
  });
});

test.describe("a team member's own security", () => {
  test("signs in with the phone code alone, signs other browsers out, and is signed out by the owner", async ({
    browser,
  }) => {
    const member = await browser.newPage();
    await signIn(member, MEMBER_PHONE, "/dashboard/security");
    await expect(member.getByRole("heading", { name: "Sign-in & security" })).toBeVisible();
    await expect(member.getByText("This browser")).toBeVisible();

    // A second browser: the phone code is all the dashboard asks for.
    const second = await browser.newPage();
    await signIn(second, MEMBER_PHONE, "/dashboard");
    await expect(second).toHaveURL(/\/dashboard$/);

    // The first browser signs the second out.
    await member.goto("/dashboard/security");
    await expect(member.getByRole("listitem")).toHaveCount(2);
    await member.getByRole("button", { name: "Sign out everywhere else" }).click();
    await member.getByRole("dialog").getByRole("button", { name: "Sign out" }).click();
    await expect(member.getByRole("listitem")).toHaveCount(1);
    await second.goto("/dashboard");
    await expect(second).toHaveURL(/\/login\?callbackUrl/);

    // The owner ends the member's remaining session from the member's page.
    const owner = await browser.newPage({ storageState: storageStatePath("owner") });
    await owner.goto("/dashboard/team/09120000555");
    await expect(owner.getByRole("list", { name: "Signed-in sessions" }).getByRole("listitem")).toHaveCount(1);
    await owner.getByRole("button", { name: "Sign out everywhere" }).click();
    await owner.getByRole("dialog").getByRole("button", { name: "Sign out" }).click();
    await expect(owner.getByText("No active sessions.")).toBeVisible();

    await member.goto("/dashboard/security");
    await expect(member).toHaveURL(/\/login\?callbackUrl/);
  });
});

test.describe("on a phone", () => {
  test.use({ storageState: storageStatePath("owner"), viewport: { width: 375, height: 812 } });

  test("the team tabs and the activity filters fit without scrolling sideways", async ({ page }) => {
    for (const path of ["/dashboard/team?tab=roles", "/dashboard/team?tab=security", "/dashboard/activity"]) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});
