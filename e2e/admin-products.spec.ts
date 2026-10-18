import { expect, test, type Locator, type Page } from "@playwright/test";

import { storageStatePath } from "./fixtures/sessions";

/** The smallest valid PNG: a 1×1 transparent pixel. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

test.use({ storageState: storageStatePath("admin") });

/** The list renders a card and a table row per item; whichever this viewport shows. */
function listed(page: Page, text: string): Locator {
  return page.getByText(text, { exact: true }).filter({ visible: true });
}

/** The base-language name; the Persian tab has a "Name" field of its own. */
function nameField(page: Page): Locator {
  return page.getByRole("tabpanel", { name: "English" }).getByLabel("Name");
}

test("an admin creates, edits and deletes a menu item, image included", async ({ page }) => {
  const name = `E2E Cortado ${Date.now()}`;

  // Create, uploading its image.
  await page.goto("/dashboard/products/create");
  await nameField(page).fill(name);
  await page.getByLabel("Category").click();
  await page.getByRole("radiogroup", { name: "Category" }).getByText("Hot drinks").click();
  await page.getByLabel(/^Price/).fill("130000");
  await page.getByLabel(/^Stock/).fill("12");
  await page.getByLabel("Item image").setInputFiles({ name: "cortado.png", mimeType: "image/png", buffer: PNG });

  const preview = page.getByRole("img", { name: "Item image preview" });
  await expect(preview).toBeVisible();
  // The upload is stored on disk and served back from /uploads.
  const imageUrl = await page.locator('input[name="imageUrl"]').inputValue();
  expect(imageUrl).toMatch(/^\/uploads\/products\/.+\.png$/);
  expect((await page.request.get(imageUrl)).status()).toBe(200);

  await page.getByRole("button", { name: "Create item" }).click();
  await expect(page).toHaveURL(/\/dashboard\/products$/);
  await expect(listed(page, name)).toBeVisible();

  // Edit it.
  await page
    .getByRole("button", { name: `Actions for ${name}`, exact: true })
    .filter({ visible: true })
    .click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await expect(page).toHaveURL(/\/dashboard\/products\/[^/]+\/edit$/);
  await nameField(page).fill(`${name} doppio`);
  await page.getByLabel(/^Price/).fill("150000");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(/\/dashboard\/products$/);
  await expect(listed(page, `${name} doppio`)).toBeVisible();

  // Delete it.
  await page
    .getByRole("button", { name: `Actions for ${name} doppio`, exact: true })
    .filter({ visible: true })
    .click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  const confirm = page.getByRole("dialog");
  await expect(confirm.getByText("Delete item?")).toBeVisible();
  await confirm.getByRole("button", { name: "Delete" }).click();
  await expect(listed(page, `${name} doppio`)).toHaveCount(0);
});

test("the form refuses a product without its required fields", async ({ page }) => {
  await page.goto("/dashboard/products/create");
  await page.getByRole("button", { name: "Create item" }).click();

  await expect(page).toHaveURL(/\/dashboard\/products\/create$/);
  await expect(nameField(page)).toHaveAttribute("aria-invalid", "true");
});
