import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { TEST_USERS } from "../tests/fixtures/users";

import { storageStatePath } from "./fixtures/sessions";

/**
 * Checkout pricing in the dashboard: a promo code and a guest's points on a counter
 * sale, a scoped code explaining why it doesn't apply, the dine-in service charge
 * set beside the VAT rate, and points expiry shown on the guest's rewards page.
 *
 * The service charge and the expiry are cafe-wide settings, so every test that
 * turns one on turns it back off — whatever happens — and the tests run in order.
 */
test.use({ storageState: storageStatePath("admin") });
test.describe.configure({ mode: "serial" });

const GUEST = TEST_USERS.customer;

/** A code no other run has used: letters and numbers only, no long digit runs. */
function uniqueCode(prefix: string): string {
  const letters = Date.now()
    .toString(36)
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  return `${prefix}${letters}`.slice(0, 16);
}

async function createCode(api: APIRequestContext, body: Record<string, unknown>): Promise<void> {
  const response = await api.post("/api/admin/promo-codes", {
    data: {
      description: "",
      maxDiscount: "",
      minSubtotal: "",
      startsOn: "",
      endsOn: "",
      usageLimit: "",
      perGuestLimit: "",
      isActive: true,
      ...body,
    },
  });
  expect(response.status()).toBe(201);
}

async function setServiceCharge(api: APIRequestContext, rate: string): Promise<void> {
  const response = await api.put("/api/admin/accounting/settings", {
    data: { vatRate: "10", serviceChargeRate: rate, booksClosedThrough: "" },
  });
  expect(response.ok()).toBe(true);
}

async function setPointsExpiry(api: APIRequestContext, months: number): Promise<void> {
  const response = await api.put("/api/admin/loyalty/settings", {
    data: { enabled: true, tomanPerPoint: 10_000, pointValue: 1_000, minRedeemPoints: 50, pointsExpiryMonths: months },
  });
  expect(response.ok()).toBe(true);
}

/** The counter with `count` espressos for the test guest, once the screen has hydrated. */
async function startSale(page: Page, count: number, phone: string = GUEST.phone): Promise<void> {
  await page.goto("/dashboard/orders/new");
  const espresso = page.getByRole("button", { name: "Add Espresso", exact: true });
  // Clicks before hydration are lost: retry until the basket shows the line.
  await expect(async () => {
    await espresso.click();
    await expect(page.getByRole("button", { name: "One less Espresso" })).toBeVisible({ timeout: 1_000 });
  }).toPass();
  for (let added = 1; added < count; added += 1) await espresso.click();
  await page.getByLabel("Guest's phone").fill(phone);
}

test("staff apply a promo code and the guest's points at the counter", async ({ page }) => {
  const code = uniqueCode("CTR");
  await createCode(page.request, { code, kind: "fixed", value: "20000" });
  const adjusted = await page.request.post("/api/admin/loyalty/adjustments", {
    data: { phone: GUEST.phone, delta: 60, note: "E2E counter points" },
  });
  expect(adjusted.status()).toBe(201);

  await startSale(page, 2);
  await expect(page.getByRole("status").filter({ hasText: GUEST.name })).toBeVisible();

  await page.getByLabel("Promo code").fill(code.toLowerCase());
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByText(`Promo code ${code}`)).toBeVisible();
  await expect(page.getByText("−20,000 Toman")).toBeVisible();

  await page.getByText(/^Spend the guest's points/).click();
  await expect(page.getByText(/^\d[\d,]* points$/)).toBeVisible();

  await page.getByRole("button", { name: "Record sale" }).click();
  const toast = page.getByText(/Sale recorded as order #\d+/).first();
  await expect(toast).toBeVisible();
  const number = (await toast.textContent())?.match(/#(\d+)/)?.[1] ?? "";

  await page.goto(`/dashboard/orders?q=${number}`);
  await page
    .getByRole("link", { name: `View order #${number}`, exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await expect(page.getByText(`Promo code ${code}`)).toBeVisible();
  await expect(page.getByText(/^\d[\d,]* points$/)).toBeVisible();
});

test("a promo code limited to books says why it doesn't apply to a coffee", async ({ page }) => {
  const code = uniqueCode("BOOKS");
  // Made in the dialog, with the category picked from the list.
  await page.goto("/dashboard/promotions");
  await expect(async () => {
    await page.getByRole("button", { name: "New code" }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1_000 });
  }).toPass();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("e.g. AUTUMN15").fill(code);
  await dialog.getByPlaceholder("10").fill("15");
  await dialog.getByRole("group", { name: "Categories (optional)" }).getByLabel("Books", { exact: true }).check();
  await dialog.getByRole("button", { name: "Create code" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("article", { name: code })).toContainText("Only on Books");

  await startSale(page, 1, "0935 700 4411");
  await page.getByLabel("Promo code").fill(code);
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "That code doesn't cover anything in this order." }),
  ).toBeVisible();
});

test("the dine-in service charge is set beside the VAT rate and shows on the sale and its order", async ({ page }) => {
  try {
    await page.goto("/dashboard/accounting/settings");
    const rate = page.getByLabel("Service charge (%)");
    await expect(async () => {
      await rate.clear();
      await rate.fill("10");
      await expect(rate).toHaveValue("10", { timeout: 1_000 });
      await expect(page.getByRole("button", { name: "Save settings" })).toBeEnabled({ timeout: 1_000 });
    }).toPass();
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Settings saved").first()).toBeVisible();

    await startSale(page, 2, "0935 700 4412");
    await page.getByLabel("Guest's name").fill("E2E Service Guest");
    await page.getByRole("button", { name: "Dine-in", exact: true }).click();
    await page.getByLabel("Table", { exact: true }).fill("E2E");
    await expect(page.getByText("Service charge (10%)")).toBeVisible();
    await expect(page.getByText("+19,000 Toman")).toBeVisible();
    await expect(page.getByTestId("counter-total")).toHaveText("209,000 Toman");

    // A takeaway carries none.
    await page.getByRole("button", { name: "Takeaway", exact: true }).click();
    await expect(page.getByText("Service charge (10%)")).toBeHidden();
    await page.getByRole("button", { name: "Dine-in", exact: true }).click();
    await expect(page.getByTestId("counter-total")).toHaveText("209,000 Toman");

    await page.getByRole("button", { name: "Record sale" }).click();
    const toast = page.getByText(/Sale recorded as order #\d+/).first();
    await expect(toast).toBeVisible();
    const number = (await toast.textContent())?.match(/#(\d+)/)?.[1] ?? "";

    await page.goto(`/dashboard/orders?q=${number}`);
    await page
      .getByRole("link", { name: `View order #${number}`, exact: true })
      .filter({ visible: true })
      .first()
      .click();
    await expect(page.getByText("Service charge (10%)")).toBeVisible();
    await expect(page.getByText("+19,000 Toman")).toBeVisible();
  } finally {
    await setServiceCharge(page.request, "0");
  }
});

test("a guest sees when their points expire once the cafe sets an expiry", async ({ page, browser }) => {
  try {
    await page.goto("/dashboard/promotions");
    const months = page.getByLabel("Points expire after (months)");
    await expect(async () => {
      await months.clear();
      await months.fill("12");
      await expect(months).toHaveValue("12", { timeout: 1_000 });
      await expect(page.getByRole("button", { name: "Save changes" })).toBeEnabled({ timeout: 1_000 });
    }).toPass();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Rewards club saved").first()).toBeVisible();

    // The guest earned points earlier in this file, so they hold some to lose.
    const guest = await browser.newContext({ storageState: storageStatePath("customer") });
    const guestPage = await guest.newPage();
    await guestPage.goto("/rewards");
    await expect(guestPage.getByTestId("points-expiry")).toContainText("Earn or spend points by");
    await expect(guestPage.getByText(/Points expire after 12 months without earning or spending\./)).toBeVisible();
    await guest.close();
  } finally {
    await setPointsExpiry(page.request, 0);
  }
});
