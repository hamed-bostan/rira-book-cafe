import { expect, test } from "@playwright/test";

import en from "../messages/en.json";
import fa from "../messages/fa.json";

test("switching to Persian and back changes the language and direction", async ({ page }) => {
  await page.goto("/menu");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("button", { name: "Add Espresso to basket" })).toBeVisible();

  await page.getByRole("button", { name: en.common.languageAria }).click();
  await page.getByRole("menuitem", { name: "فارسی" }).click();

  // The choice is a cookie and a reload: same URL, Persian copy, right-to-left.
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page).toHaveURL(/\/menu$/);
  await expect(page.getByText("اسپرسو").first()).toBeVisible();

  // It sticks across navigation.
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");

  await page.getByRole("button", { name: fa.common.languageAria }).click();
  await page.getByRole("menuitem", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});
