import { readFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";

import { cafeDayOf } from "../src/domain/entities/CafeTime";
import { toJalali } from "../src/domain/entities/JalaliCalendar";

import { E2E_BASE_URL } from "./fixtures/env";
import { storageStatePath } from "./fixtures/sessions";

/**
 * Insights' tools: the range picker (calendar presets and a month grid on the
 * reader's calendar), when refunds count, the CSV downloads and the printout —
 * each one a URL, so a report can be shared as it stands.
 */

test.use({ storageState: storageStatePath("admin") });

const PERSIAN_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

/** Opens the range picker — once the page is live, so the click isn't lost before hydration. */
async function openPicker(page: Page, name: RegExp | string): Promise<void> {
  const trigger = page.getByRole("button", { name });
  await expect(async () => {
    await trigger.click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1000 });
  }).toPass();
}

test.describe("in English", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([{ name: "NEXT_LOCALE", value: "en", url: E2E_BASE_URL }]);
  });

  test("picks this month, then a custom span, and keeps each in the URL", async ({ page }) => {
    await page.goto("/dashboard/reports");
    await expect(page.getByRole("heading", { name: "From gross sales to revenue" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Revenue by stream" })).toBeVisible();

    await openPicker(page, "Pick dates");
    await page.getByRole("dialog").getByRole("link", { name: "This month" }).click();
    await expect(page).toHaveURL(/[?&]range=month\b/);
    await expect(page.getByRole("button", { name: /This month/ })).toBeVisible();

    await openPicker(page, /This month/);
    const dialog = page.getByRole("dialog");
    const days = dialog.locator("button[data-day]:enabled");
    await days.first().click();
    await expect(dialog.getByText("now pick the last day")).toBeVisible();
    await days.nth(2).click();
    await dialog.getByRole("button", { name: "Show these dates" }).click();

    await expect(page).toHaveURL(/[?&]from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}/);
    expect(new URL(page.url()).searchParams.get("range")).toBeNull();
    // The other reports keep the span.
    await page.getByRole("link", { name: "Payments", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard\/reports\/payments\?.*from=/);
  });

  test("counts refunds on the day they happened when asked, with a hint saying what that means", async ({ page }) => {
    await page.goto("/dashboard/reports?range=30d");
    await expect(page.getByText(/comes off the day its order was placed/)).toBeVisible();

    await page.getByRole("link", { name: "Refund's day" }).click();
    await expect(page).toHaveURL(/refunds=refundDay/);
    await expect(page).toHaveURL(/range=30d/);
    await expect(page.getByText(/counts on the day the money went back/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Refund's day" })).toHaveAttribute("aria-current", "true");

    await page.getByRole("link", { name: "Payments", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard\/reports\/payments\?.*refunds=refundDay/);
    await expect(page.getByRole("region", { name: "VAT in revenue" })).toBeVisible();
  });

  test("downloads a table as a spreadsheet Excel reads", async ({ page }) => {
    await page.goto("/dashboard/reports?range=7d");
    const exportButton = page.getByRole("button", { name: "Export CSV" });
    await expect(async () => {
      await exportButton.click();
      await expect(page.getByRole("menu")).toBeVisible({ timeout: 1000 });
    }).toPass();

    const downloading = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: "Revenue by stream" }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toMatch(/^streams-\d{4}-\d{2}-\d{2}-to-\d{4}-\d{2}-\d{2}\.csv$/);
    const bytes = await readFile(await download.path());
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(bytes.toString("utf8")).toContain("Cafe orders");
  });

  test("prints the report alone, headed with the cafe's name and the dates", async ({ page }) => {
    await page.goto("/dashboard/reports/payments?range=7d");
    await expect(page.getByRole("button", { name: "Print" })).toBeVisible();

    await page.emulateMedia({ media: "print" });
    await expect(page.getByText("Rira Book Cafe · Payments report")).toBeVisible();
    await expect(page.getByRole("button", { name: "Print" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Pick dates" })).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Date range" })).toBeHidden();
    // The caption says how refunds were counted, since the switch isn't on paper.
    await expect(page.getByText(/· refunds on the order's day/)).toBeVisible();
  });
});

test.describe("in Persian", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([{ name: "NEXT_LOCALE", value: "fa", url: E2E_BASE_URL }]);
  });

  test("picks dates on the Jalali calendar", async ({ page }) => {
    await page.goto("/dashboard/reports");
    await openPicker(page, "انتخاب تاریخ");

    const today = toJalali(cafeDayOf(new Date()));
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(PERSIAN_MONTHS[today.jm - 1], { exact: false }).first()).toBeVisible();
    // The grid's days are Jalali days: today's number is on it, in Persian digits.
    const todayButton = dialog.locator(`button[data-day="${cafeDayOf(new Date())}"]`);
    await expect(todayButton).toHaveText(new Intl.NumberFormat("fa-IR").format(today.jd));

    await dialog.getByRole("link", { name: "این ماه" }).click();
    await expect(page).toHaveURL(/[?&]range=month\b/);
  });
});
