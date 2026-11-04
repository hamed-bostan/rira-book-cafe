import { expect, test, type Page } from "@playwright/test";

import { storageStatePath } from "./fixtures/sessions";

test.use({ storageState: storageStatePath("admin") });

/** A name no other run has used, without long digit runs (they read as figures). */
function uniqueName(prefix: string): string {
  return `${prefix} ${Math.random().toString(36).slice(2, 8).replace(/\d/g, "x")}`;
}

async function createSupplier(page: Page, name: string): Promise<string> {
  const response = await page.request.post("/api/admin/suppliers", {
    data: { name, phone: "", note: "", isActive: true },
  });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { id: string }).id;
}

test("a stock item is made on Inventory, received in packs, adjusted and ordered", async ({ page }) => {
  const name = uniqueName("Oat milk");

  await page.goto("/dashboard/inventory");
  await expect(async () => {
    await page.getByRole("button", { name: "New stock item" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1000 });
  }).toPass();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByLabel("Counted in").selectOption("ml");
  await dialog.getByLabel("Reorder at (ml)").fill("2000");
  await dialog.getByLabel("Par level (ml)").fill("6000");
  await dialog.getByRole("button", { name: "Add a pack size" }).click();
  await dialog.getByLabel("Pack name").fill("carton");
  await dialog.getByLabel("How many ml in the pack").fill("1000");
  await dialog.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByText(`${name} saved`).first()).toBeVisible();

  const row = page.getByRole("article", { name });
  await expect(row).toBeVisible();

  // Receive two cartons at 90,000 each.
  await row.getByRole("button", { name: /More actions/ }).click();
  await page.getByRole("menuitem", { name: "Receive delivery" }).click();
  const receive = page.getByRole("dialog");
  await receive.getByRole("combobox", { name: "Unit", exact: true }).selectOption("carton");
  await receive.getByLabel("Quantity (carton)").fill("2");
  await receive.getByLabel("Cost is for").selectOption("unit");
  await receive.getByLabel("Cost per carton (Toman)").fill("90000");
  await expect(receive.getByText(/On hand goes from 0 ml to 2,000 ml/)).toBeVisible();
  await receive.getByRole("button", { name: "Add to stock" }).click();
  await expect(row.getByText("2,000 ml").first()).toBeVisible();

  // A staff meal takes 250 ml out.
  await row.getByRole("button", { name: /More actions/ }).click();
  await page.getByRole("menuitem", { name: "Adjust stock" }).click();
  const adjust = page.getByRole("dialog");
  await adjust.getByLabel("Reason").selectOption("staffMeal");
  await adjust.getByLabel("Quantity (ml)").fill("250");
  await adjust.getByRole("button", { name: "Save adjustment" }).click();
  await expect(row.getByText("1,750 ml").first()).toBeVisible();

  // Its history: the adjustment with its reason, and the balance after each change.
  await row.getByRole("button", { name: /More actions/ }).click();
  await page.getByRole("menuitem", { name: "Stock history" }).click();
  await expect(page).toHaveURL(/\/dashboard\/inventory\/movements\?item=/);
  await expect(page.getByRole("columnheader", { name: "On hand after" })).toBeVisible();
  await expect(page.getByText("Staff meal")).toBeVisible();
  await expect(page.getByRole("link", { name: "Export CSV" })).toBeVisible();

  // Running low (1,750 ≤ 2,000): on the order list, topped up to par in whole cartons.
  await page.goto("/dashboard/inventory/to-order");
  const line = page.getByRole("row").filter({ hasText: name });
  await expect(line).toContainText("5 × carton (5,000 ml)");
});

test("stock goes back to the supplier against a credit that settles the delivery's bill", async ({ page }) => {
  const supplierName = uniqueName("Roastery");
  const itemName = uniqueName("Single origin");
  const supplierId = await createSupplier(page, supplierName);
  const created = await page.request.post("/api/admin/inventory/items", {
    data: { name: itemName, unit: "g", reorderLevel: "", parLevel: "", purchaseUnits: [], supplierId },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };
  const delivered = await page.request.post("/api/admin/inventory/receipts", {
    data: {
      date: new Date().toISOString().slice(0, 10),
      supplierId,
      description: "Beans",
      lines: [{ ingredientId: id, quantity: "2000", cost: "1000000" }],
      vatAmount: "",
      payment: "unpaid",
    },
  });
  expect(delivered.status()).toBe(201);
  const delivery = (await delivered.json()) as { id: string; number: number };

  await page.goto(`/dashboard/expenses/${delivery.id}`);
  await page.getByRole("link", { name: "Return goods from this delivery" }).click();
  await expect(page).toHaveURL(/\/dashboard\/inventory\/returns\/new\?expense=/);

  await expect(async () => {
    await page.getByLabel("Item").first().selectOption(id);
    await expect(page.getByLabel("Item").first()).toHaveValue(id, { timeout: 1000 });
  }).toPass();
  await page.getByLabel("Quantity").first().fill("500");
  await page.getByLabel("Credit (Toman, VAT included)").fill("250000");
  await expect(page.getByText(`250,000 Toman comes off what's owed on EX-${delivery.number}.`)).toBeVisible();
  await page.getByRole("button", { name: "Save return" }).click();

  await expect(page).toHaveURL(/\/dashboard\/inventory\/returns$/);
  const card = page.getByRole("article").filter({ hasText: supplierName });
  await expect(card).toContainText(itemName);
  await expect(card).toContainText(`From delivery EX-${delivery.number}`);
});
