import { expect, request, test, type APIRequestContext, type Page } from "@playwright/test";

import { cafeDayOf, shiftCafeDay } from "../src/domain/entities/CafeTime";

import { E2E_BASE_URL } from "./fixtures/env";
import { jsonOf } from "./fixtures/responsive";
import { storageStatePath } from "./fixtures/sessions";

/**
 * Finance B's clicks nothing else makes: a new account made and switched off; a
 * quick manual entry posted from the header; a bank line booked as a fee, unmatched
 * (which takes the fee back) and booked again; and an item's own profit % set and
 * cleared on the pricing page.
 */

test.use({ storageState: storageStatePath("admin") });

const today = cafeDayOf(new Date());

type Account = { code: string; isActive: boolean };

async function adminApi(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: E2E_BASE_URL, storageState: storageStatePath("admin") });
}

/** A toast's title (its live region repeats it with a prefix). */
function toast(page: Page, text: string | RegExp) {
  return page.getByText(text, typeof text === "string" ? { exact: true } : undefined).first();
}

test("a new account is made from its dialog and switched off", async ({ page }) => {
  const api = await adminApi();
  // A code no earlier run took (the database is fresh per run, but a rerun of this spec isn't).
  const taken = new Set((await jsonOf<Account[]>(await api.get("/api/admin/accounting/accounts"))).map((a) => a.code));
  const code = ["6950", "6951", "6952", "6953", "6954"].find((one) => !taken.has(one)) ?? "6955";

  await page.goto("/dashboard/accounting/accounts");
  await page.getByRole("button", { name: "New account" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Code").fill(code);
  await dialog.getByLabel("Name (English)").fill("Plants and flowers");
  await dialog.getByLabel("Name (Persian)").fill("گل و گیاه");
  await dialog.getByLabel("Type").selectOption("expense");
  await dialog.getByRole("button", { name: "Create account" }).click();
  await expect(toast(page, `Account ${code} created`)).toBeVisible();

  const active = page.getByRole("switch", { name: `Account ${code} active` });
  await active.click();
  await expect(active).not.toBeChecked();
  await expect
    .poll(
      async () =>
        (await jsonOf<Account[]>(await api.get("/api/admin/accounting/accounts"))).find((a) => a.code === code)
          ?.isActive,
    )
    .toBe(false);
  await api.dispose();
});

test("a quick manual entry is posted from the header", async ({ page }) => {
  await page.goto("/dashboard/accounting");
  await page.getByRole("button", { name: "New manual entry" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Amount (Toman)").fill("150000");
  await dialog.getByLabel("Description").fill("Owner top-up for change");
  await dialog.getByLabel("Debit").selectOption("1110");
  await dialog.getByLabel("Credit").selectOption("3100");
  await dialog.getByRole("button", { name: "Post entry" }).click();
  await expect(toast(page, /^Posted JE-\d+$/)).toBeVisible();
});

test("a bank line is booked as a fee, unmatched — which takes the fee back — and booked again", async ({ page }) => {
  const api = await adminApi();
  // The three days before today: the layout spec keeps today's statement, which then still
  // follows this one (it opens at 0, as this one closes).
  const fromDay = shiftCafeDay(today, -3);
  const toDay = shiftCafeDay(today, -1);
  const existing = await jsonOf<{ id: string; fromDay: string; toDay: string }[]>(
    await api.get("/api/admin/accounting/bank-statements"),
  );
  const statement =
    existing.find((one) => one.fromDay === fromDay && one.toDay === toDay) ??
    (await jsonOf<{ id: string }>(
      await api.post("/api/admin/accounting/bank-statements", {
        data: {
          fromDay,
          toDay,
          openingBalance: "0",
          closingBalance: "0",
          lines: [{ date: toDay, description: "Monthly account charge", reference: "", amount: "-5000" }],
        },
      }),
    ));
  const feeEntries = async (): Promise<{ id: string; reversedById?: string }[]> =>
    (
      await jsonOf<{ items: { id: string; source: string; reversedById?: string }[] }>(
        await api.get("/api/admin/accounting/journal?source=bankFee&pageSize=100"),
      )
    ).items;
  /** Fee entries on the books: all of them, and those not taken back. */
  const fees = async (): Promise<{ all: number; live: number }> => {
    const entries = await feeEntries();
    return { all: entries.length, live: entries.filter((entry) => !entry.reversedById).length };
  };
  const before = await fees();

  await page.goto(`/dashboard/accounting/bank/${statement.id}`);
  await page.getByRole("button", { name: "Line actions" }).first().click();
  await page.getByRole("menuitem", { name: "Book as a bank fee" }).click();
  await expect.poll(fees).toEqual({ all: before.all + 1, live: before.live + 1 });

  await page.getByRole("button", { name: "Unmatch" }).first().click();
  await expect(toast(page, "Match undone")).toBeVisible();
  // The fee went with the match: still on record, but reversed.
  await expect.poll(fees).toEqual({ all: before.all + 1, live: before.live });

  await page.getByRole("button", { name: "Line actions" }).first().click();
  await page.getByRole("menuitem", { name: "Book as a bank fee" }).click();
  // Booked once, not twice.
  await expect.poll(fees).toEqual({ all: before.all + 2, live: before.live + 1 });
  await api.dispose();
});

test("an item's own profit % is set and cleared on the pricing page", async ({ page }) => {
  await page.goto("/dashboard/pricing");
  const field = page.getByLabel("Profit % for this item").first();
  await field.fill("75");
  await field.press("Enter");
  await expect(toast(page, "Profit saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Profit % for this item").first()).toHaveValue("75");

  // Blank goes back to the cafe-wide default, so the menu's pricing is as it was.
  await page.getByLabel("Profit % for this item").first().fill("");
  await page.getByLabel("Profit % for this item").first().press("Enter");
  await expect(toast(page, "Profit saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Profit % for this item").first()).toHaveValue("");
});
