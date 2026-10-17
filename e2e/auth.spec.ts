import { expect, test } from "@playwright/test";

import en from "../messages/en.json";
import { TEST_USERS } from "../tests/fixtures/users";

import { storageStatePath } from "./fixtures/sessions";

test.describe("signing in", () => {
  test("a guest signs in with a one-time code", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Phone number").fill(TEST_USERS.customer.phone);
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page).toHaveURL(/\/login\/verify/);
    // The mock OTP (OTP_MOCK=true) shows the code on screen in place of an SMS.
    await page.getByRole("button", { name: /Dev code:/ }).click();
    await page.getByRole("button", { name: "Verify Code" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("link", { name: /^Notifications/ })).toBeVisible();
  });

  test("a wrong code is refused", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Phone number").fill(TEST_USERS.staff.phone);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/login\/verify/);

    const devCode = (await page.getByRole("button", { name: /Dev code:/ }).textContent()) ?? "";
    const real = devCode.match(/\d{4}/)?.[0] ?? "0000";
    const wrong = real === "1234" ? "4321" : "1234";
    await page.getByLabel("Verification code").pressSequentially(wrong);
    await page.getByRole("button", { name: "Verify Code" }).click();

    await expect(page.getByText(en.auth.incorrectCode)).toBeVisible();
    await expect(page).toHaveURL(/\/login\/verify/);
  });
});

test.describe("the dashboard is staff-only", () => {
  test("an anonymous visitor is sent to sign in", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fdashboard/);
  });

  test.describe("as a guest", () => {
    test.use({ storageState: storageStatePath("customer") });

    test("is sent back to the storefront", async ({ page }) => {
      await page.goto("/dashboard");

      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
  });

  test.describe("as staff", () => {
    test.use({ storageState: storageStatePath("staff") });

    test("reaches the dashboard but not the catalog editor", async ({ page }) => {
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/dashboard$/);

      // Staff lack catalog.write: the create page bounces them to the dashboard root.
      await page.goto("/dashboard/products/create");
      await expect(page).toHaveURL(/\/dashboard$/);
    });
  });
});
