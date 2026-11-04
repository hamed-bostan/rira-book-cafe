import { expect, test, type Page } from "@playwright/test";

import { measurePageOverflow, openWithFonts } from "./fixtures/responsive";
import { storageStatePath } from "./fixtures/sessions";

/** The smallest valid PNG: a 1×1 transparent pixel. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

/** No long digit runs in the name: the responsive checks read those as spilled figures. */
const NAME = `E2E Options Latte ${Math.random().toString(36).replace(/\d/g, "").slice(0, 6)}`;

let productId = "";

/** The item made by the first test, found by name. */
async function findProduct(page: Page): Promise<string> {
  const response = await page.request.get(`/api/products?q=${encodeURIComponent(NAME)}`);
  const items = (await response.json()) as { id: string; name: string }[];
  const item = items.find((candidate) => candidate.name === NAME);
  if (!item) throw new Error(`${NAME} isn't on the menu`);
  return item.id;
}

test.describe.serial("product options", () => {
  test.describe("in the dashboard", () => {
    test.use({ storageState: storageStatePath("admin") });

    test("an admin gives a new item a size and extras", async ({ page }) => {
      await page.goto("/dashboard/products/create");
      // Fills before hydration are reset; retry until the form holds them.
      await expect(async () => {
        await page.getByRole("group", { name: "English" }).getByLabel("Name").fill(NAME);
        await expect(page.getByRole("group", { name: "English" }).getByLabel("Name")).toHaveValue(NAME);
      }).toPass();
      await page.getByLabel("Category").click();
      await page.getByRole("radiogroup", { name: "Category" }).getByText("Hot drinks").click();
      await page.getByLabel(/^Price/).fill("100000");
      await page.getByLabel(/^Stock/).fill("20");
      await page.getByLabel("Item image").setInputFiles({ name: "latte.png", mimeType: "image/png", buffer: PNG });
      await expect(page.getByRole("img", { name: "Item image preview" })).toBeVisible();

      // Size: required, one choice, Small (the default) or Large (+20,000).
      await page.getByRole("button", { name: "Add option group" }).click();
      const size = page.getByTestId("option-group").nth(0);
      await size.getByLabel("Group name").fill("Size");
      await size.getByLabel("Persian name").fill("اندازه");
      await size.getByLabel("Choice", { exact: true }).nth(0).fill("Small");
      await size.getByLabel("Choice", { exact: true }).nth(1).fill("Large");
      await size.getByLabel("Adds (Toman)").nth(1).fill("20000");

      // Extras: optional, up to two.
      await page.getByRole("button", { name: "Add option group" }).click();
      const extras = page.getByTestId("option-group").nth(1);
      await extras.getByLabel("Group name").fill("Extras");
      await extras.getByRole("button", { name: "Several" }).click();
      await extras.getByRole("switch", { name: "Group 2 is required" }).click();
      await extras.getByLabel("At most").fill("2");
      await extras.getByLabel("Choice", { exact: true }).nth(0).fill("Oat milk");
      await extras.getByLabel("Adds (Toman)").nth(0).fill("12000");
      await extras.getByLabel("Choice", { exact: true }).nth(1).fill("Extra shot");
      await extras.getByLabel("Adds (Toman)").nth(1).fill("15000");

      await page.getByRole("button", { name: "Create item" }).click();
      await expect(page).toHaveURL(/\/dashboard\/products$/);
      productId = await findProduct(page);

      // The edit form reads them back.
      await page.goto(`/dashboard/products/${productId}/edit`);
      await expect(page.getByTestId("option-group")).toHaveCount(2);
      await expect(page.getByTestId("option-group").nth(1).getByLabel("At most")).toHaveValue("2");
    });

    test("the options editor fits a phone", async ({ page }) => {
      await openWithFonts(page, `/dashboard/products/${productId}/edit`);
      await expect(page.getByTestId("option-group")).toHaveCount(2);
      expect(await page.evaluate(measurePageOverflow)).toEqual({ by: 0, culprits: [] });
    });
  });

  test.describe("for the guest", () => {
    test.use({ storageState: storageStatePath("customer") });

    test("chooses options at a live price and orders them; the bar sees them", async ({ page, browser }) => {
      await page.goto(`/menu/${productId}`);
      await expect(page.getByText("from 100,000 Toman")).toBeVisible();

      const total = page.getByTestId("live-total");
      await expect(total).toHaveText("100,000 Toman");
      await expect(async () => {
        await page.getByRole("radio", { name: /^Large/ }).click();
        await expect(total).toHaveText("120,000 Toman");
      }).toPass();
      await page.getByRole("checkbox", { name: /^Oat milk/ }).click();
      await expect(total).toHaveText("132,000 Toman");
      await page.getByRole("button", { name: "Add to basket · 132,000 Toman" }).click();

      await page.goto("/basket");
      await expect(page.getByText("Large, Oat milk")).toBeVisible();
      await page.getByText("Takeaway", { exact: true }).click();
      await page.getByRole("button", { name: "Place order" }).click();
      await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);
      await expect(page.getByText("Large, Oat milk")).toBeVisible();

      const staff = await browser.newContext({ storageState: storageStatePath("staff") });
      try {
        const bar = await staff.newPage();
        await bar.goto("/dashboard/kitchen");
        await expect(bar.getByText("Large, Oat milk").filter({ visible: true }).first()).toBeVisible();
      } finally {
        await staff.close();
      }
    });
  });

  test.describe("at the counter", () => {
    test.use({ storageState: storageStatePath("staff") });

    test("staff choose an item's options before it goes on the sale", async ({ page }) => {
      await page.goto("/dashboard/orders/new");
      await expect(async () => {
        await page.getByLabel("Search the menu").fill(NAME);
        await page.getByRole("button", { name: `Add ${NAME}`, exact: true }).click();
        await expect(page.getByRole("group", { name: `Options for ${NAME}` })).toBeVisible();
      }).toPass();
      const panel = page.getByRole("group", { name: `Options for ${NAME}` });
      await panel.getByRole("radio", { name: /^Large/ }).click();
      await panel.getByRole("checkbox", { name: /^Extra shot/ }).click();
      await panel.getByRole("button", { name: "Add · 135,000 Toman" }).click();

      await expect(panel).toBeHidden();
      await expect(page.getByText("Large, Extra shot")).toBeVisible();
      await expect(page.getByText("135,000 Toman").first()).toBeVisible();
    });
  });
});
