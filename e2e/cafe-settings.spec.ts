import { expect, request, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";

import { E2E_BASE_URL } from "./fixtures/env";
import { PHONE, jsonOf, measurePageOverflow, openWithFonts } from "./fixtures/responsive";
import { storageStatePath } from "./fixtures/sessions";

/**
 * The cafe's settings page (dashboard → Settings): the profile and opening hours
 * reach the home page, a table added there reaches the floor, and the receipt's
 * own lines print on an order's receipt. Settings are one record the whole suite
 * shares, so they're put back as the run found them afterwards.
 */

const BLANK = {
  profile: {
    name: "",
    nameFa: "",
    address: "",
    addressFa: "",
    phone: "",
    instagram: "",
    website: "",
    latitude: "",
    longitude: "",
  },
  receipt: { header: "", headerFa: "", footer: "", footerFa: "" },
};

async function asAdmin<T>(work: (api: APIRequestContext) => Promise<T>): Promise<T> {
  const api = await request.newContext({ baseURL: E2E_BASE_URL, storageState: storageStatePath("admin") });
  try {
    return await work(api);
  } finally {
    await api.dispose();
  }
}

/** One settings card, found by its form's name. */
function card(page: Page, name: string): Locator {
  return page.getByRole("form", { name });
}

/** Letters only — a seeded name with a run of digits trips the figure checks. */
function stamp(): string {
  return Array.from({ length: 5 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join("");
}

test.describe("as an admin", () => {
  test.use({ storageState: storageStatePath("admin") });

  test.afterAll(async () => {
    await asAdmin(async (api) => {
      await jsonOf(await api.put("/api/admin/settings/profile", { data: BLANK.profile }));
      await jsonOf(await api.put("/api/admin/settings/hours", { data: { weekly: null, exceptions: [] } }));
      await jsonOf(await api.put("/api/admin/settings/receipt", { data: BLANK.receipt }));
    });
  });

  test("the café's profile and hours, saved in Settings, show on the home page", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Settings" }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/settings$/);
    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
    await expect(page.getByText("Asia/Tehran")).toBeVisible();

    const profile = card(page, "Café profile");
    const english = profile.getByRole("group", { name: "English" });
    // A fill made before the form hydrates is reset by it; retry until it holds.
    await expect(async () => {
      await english.getByLabel("Address").fill("Vali-e Asr Street\nTehran");
      await expect(english.getByLabel("Address")).toHaveValue("Vali-e Asr Street\nTehran");
    }).toPass();
    await profile.getByRole("group", { name: "Persian" }).getByLabel("Address").fill("تهران، خیابان ولیعصر");
    await profile.getByLabel("Phone").fill("021 5555 0101");
    await profile.getByLabel("Instagram").fill("https://www.instagram.com/rira.cafe/");
    await profile.getByLabel("Latitude").fill("35.7");
    await expect(profile.getByText("Enter both latitude and longitude, or neither.")).toBeHidden();
    await profile.getByRole("button", { name: "Save profile" }).click();
    await expect(profile.getByText("Enter both latitude and longitude, or neither.")).toBeVisible();
    await profile.getByLabel("Longitude").fill("51.4");
    await expect(profile.getByRole("link", { name: "Check on the map" })).toBeVisible();
    await profile.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Café profile saved", { exact: true })).toBeVisible();
    await expect(profile.getByLabel("Instagram")).toHaveValue("rira.cafe");

    const hours = card(page, "Opening hours");
    await expect(hours.getByText(/Not set yet/)).toBeVisible();
    await hours.getByRole("checkbox", { name: "Closed on Friday" }).click();
    await expect(hours.getByLabel("Opens on Friday")).toHaveCount(0);
    await hours.getByLabel("Opens on Saturday").fill("09:00");
    await hours.getByRole("button", { name: "Add special day" }).click();
    await hours.getByLabel("Date").fill("2030-03-21");
    await hours.getByLabel("Why (English)").fill("Nowruz");
    await hours.getByRole("button", { name: "Save hours" }).click();
    await expect(page.getByText("Opening hours saved", { exact: true })).toBeVisible();
    await expect(hours.getByText(/Not set yet/)).toBeHidden();

    // The home page reads the settings from its cache, which the saves expired.
    await page.goto("/");
    const visit = page.locator("#visit");
    await expect(visit.getByText("Vali-e Asr Street")).toBeVisible();
    await expect(visit.getByRole("link", { name: "Get directions" })).toHaveAttribute("href", /mlat=35\.7&mlon=51\.4/);
    await expect(visit.getByRole("link", { name: /Call the café/ })).toHaveAttribute("href", "tel:02155550101");
    await expect(visit.getByRole("link", { name: /on Instagram/ })).toHaveAttribute(
      "href",
      "https://www.instagram.com/rira.cafe/",
    );
    const week = visit.getByRole("definition");
    await expect(visit.getByRole("term").filter({ hasText: "Sat" }).first()).toBeVisible();
    await expect(week.filter({ hasText: "9:00 AM – 10:00 PM" })).toBeVisible();
    await expect(week.filter({ hasText: "Closed" }).first()).toBeVisible();

    // The structured data names the address and the hours too.
    const jsonLd = (await page.locator('script[type="application/ld+json"]').allTextContents()).join("\n");
    expect(jsonLd).toContain('"telephone":"021 5555 0101"');
    expect(jsonLd).toContain('"opens":"09:00"');
  });

  test("a table added in Settings joins the floor, and leaves it once out of use", async ({ page }) => {
    const label = `Bar ${stamp()}`;
    await page.goto("/dashboard/settings");
    const tables = page.getByRole("list", { name: "Tables" });
    await expect(tables.getByRole("listitem")).toHaveCount(9);

    await expect(async () => {
      await page.getByRole("button", { name: "Add table" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
    }).toPass();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Label").fill(label);
    await dialog.getByLabel("Seats").fill("3");
    await dialog.getByLabel("Area").fill("Counter");
    await dialog.getByRole("button", { name: "Add table" }).click();
    await expect(page.getByText(`Table ${label} added`, { exact: true })).toBeVisible();
    const row = tables.getByRole("listitem", { name: `Table ${label}` });
    await expect(row).toContainText("Seats 3 · Counter");

    const floor = async (): Promise<string[]> =>
      asAdmin(async (api) => {
        const read = await jsonOf<{ tables: { label: string }[] }>(await api.get("/api/admin/reservations/floor"));
        return read.tables.map((table) => table.label);
      });
    expect(await floor()).toContain(label);

    await row.getByRole("button", { name: `More actions for Table ${label}` }).click();
    await page.getByRole("menuitem", { name: "Take out of use" }).click();
    await expect(row.getByText("Out of use")).toBeVisible();
    expect(await floor()).not.toContain(label);

    await row.getByRole("button", { name: `More actions for Table ${label}` }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete table" }).click();
    await expect(page.getByText(`Table ${label} deleted`, { exact: true })).toBeVisible();
    await expect(row).toHaveCount(0);
  });

  test("the receipt's header and closing note print on an order's receipt", async ({ page }) => {
    await page.goto("/dashboard/settings");
    const receipt = card(page, "Receipt");
    const english = receipt.getByRole("group", { name: "English" });
    await expect(async () => {
      await english.getByLabel("Header").fill("Coffee · Books · Friends");
      await expect(english.getByLabel("Header")).toHaveValue("Coffee · Books · Friends");
    }).toPass();
    await english.getByLabel("Closing note").fill("Come back for the book club!");
    await receipt.getByRole("button", { name: "Save receipt" }).click();
    await expect(page.getByText("Receipt saved", { exact: true })).toBeVisible();

    const guest = await request.newContext({ baseURL: E2E_BASE_URL, storageState: storageStatePath("customer") });
    const order = await jsonOf<{ id: string; orderNumber: number }>(
      await guest.post("/api/orders", {
        data: { items: [{ productId: "seed-espresso", quantity: 1 }], serviceType: "takeaway" },
      }),
    );
    await guest.dispose();
    await page.goto(`/dashboard/orders/${order.id}/receipt`);
    const slip = page.getByRole("article", { name: `Receipt for order #${order.orderNumber}` });
    await expect(slip.getByText("Coffee · Books · Friends")).toBeVisible();
    await expect(slip.getByText("Come back for the book club!")).toBeVisible();
    await expect(slip.getByText("Thank you — see you again soon.")).toHaveCount(0);
  });

  test("the settings page fits a phone", async ({ page }) => {
    await openWithFonts(page, "/dashboard/settings");
    expect(page.viewportSize()).toEqual(PHONE);
    expect(await page.evaluate(measurePageOverflow)).toEqual({ by: 0, culprits: [] });
  });
});

test.describe("as floor staff", () => {
  test.use({ storageState: storageStatePath("staff") });

  test("Settings isn't offered, and its page sends them away", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);

    await page.goto("/dashboard/settings");
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
