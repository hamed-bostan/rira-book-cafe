import { randomBytes } from "node:crypto";

import { expect, request, test, type APIRequestContext, type Page } from "@playwright/test";

import { cafeDayOf } from "../src/domain/entities/CafeTime";
import { recentJalaliPeriods } from "../src/domain/entities/JalaliCalendar";

import { E2E_BASE_URL } from "./fixtures/env";
import { jsonOf } from "./fixtures/responsive";
import { storageStatePath } from "./fixtures/sessions";

/**
 * Finance A's clicks nothing else makes: a cash shift opened with a float and closed
 * short; an expense voided from its row; a recurring bill, a supplier and an
 * employee each edited and switched off; and a pay run voided.
 */

test.use({ storageState: storageStatePath("admin") });

const today = cafeDayOf(new Date());
/** Six random letters, so this run's records are told apart from earlier runs'. */
const TAG = `E2E Fa ${Array.from(randomBytes(6), (byte) => String.fromCharCode(97 + (byte % 26))).join("")}`;

type Shift = { id: string; number: number; status: string; expectedCash?: number; countedCash?: number };

async function adminApi(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: E2E_BASE_URL, storageState: storageStatePath("admin") });
}

/** A toast's title (its live region repeats it with a prefix). */
function toast(page: Page, text: string | RegExp) {
  return page.getByText(text, typeof text === "string" ? { exact: true } : undefined).first();
}

test("a cash shift is opened with a float and closed short", async ({ page }) => {
  const api = await adminApi();
  // One shift at a time: an earlier one still open is counted out at what it expects.
  const { current } = await jsonOf<{ current: Shift | null }>(await api.get("/api/admin/cash-shifts"));
  if (current) {
    await jsonOf(
      await api.post(`/api/admin/cash-shifts/${current.id}/close`, {
        data: { countedCash: current.expectedCash ?? 0, note: "" },
      }),
    );
  }

  await page.goto("/dashboard/cash-shifts");
  await page.getByLabel("Opening float (Toman)").fill("500000");
  await page.getByRole("button", { name: /^Open shift Z-/ }).click();
  await expect(toast(page, /^Shift Z-\d+ opened$/)).toBeVisible();

  await page.getByLabel("Cash counted (Toman)").fill("490000");
  await page.getByRole("button", { name: "Close shift" }).click();
  await expect(toast(page, /^Shift Z-\d+ closed/)).toBeVisible();

  const { current: after, recent } = await jsonOf<{ current: Shift | null; recent: Shift[] }>(
    await api.get("/api/admin/cash-shifts"),
  );
  expect(after).toBeNull();
  expect(recent[0]).toMatchObject({ status: "closed", expectedCash: 500000, countedCash: 490000 });
  await api.dispose();
});

test("an expense is voided from its row", async ({ page }) => {
  const api = await adminApi();
  const expense = await jsonOf<{ id: string; number: number }>(
    await api.post("/api/admin/expenses", {
      data: {
        date: today,
        supplierId: "",
        accountCode: "6100",
        description: `${TAG} Window cleaning`,
        amount: "300000",
        vatAmount: "",
        payment: "cash",
      },
    }),
  );

  await page.goto(`/dashboard/expenses?q=EX-${expense.number}`);
  await page.getByRole("button", { name: `More actions for EX-${expense.number}` }).click();
  await page.getByRole("menuitem", { name: "Void" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Reason (optional)").fill("Entered twice");
  await dialog.getByRole("button", { name: "Void expense" }).click();
  await expect(toast(page, `EX-${expense.number} voided`)).toBeVisible();
  const detail = await jsonOf<{ expense: { status: string } }>(await api.get(`/api/admin/expenses/${expense.id}`));
  expect(detail.expense.status).toBe("void");
  await api.dispose();
});

test("a recurring bill, a supplier and an employee are each edited and switched off", async ({ page }) => {
  const api = await adminApi();
  const bill = `${TAG} Internet`;
  const supplier = `${TAG} Paper Co`;
  const employee = `${TAG} Navid`;
  await jsonOf(
    await api.post("/api/admin/recurring-bills", {
      data: {
        description: bill,
        accountCode: "6100",
        supplierId: "",
        amount: "2000000",
        vatAmount: "",
        dayOfMonth: 5,
        isActive: true,
      },
    }),
  );
  await jsonOf(
    await api.post("/api/admin/suppliers", { data: { name: supplier, phone: "", note: "", isActive: true } }),
  );
  await jsonOf(
    await api.post("/api/admin/payroll/employees", {
      data: { name: employee, position: "Barista", phone: "", monthlySalary: "150000000", isActive: true },
    }),
  );

  /** Opens a row's Edit dialog, switches it off, saves, and waits for the saved toast. */
  async function switchOff(edit: string, saved: string): Promise<void> {
    await page.getByRole("button", { name: edit }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("switch").click();
    await expect(dialog.getByRole("switch")).not.toBeChecked();
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(toast(page, saved)).toBeVisible();
  }

  await page.goto("/dashboard/expenses/recurring");
  await switchOff(`Edit ${bill}`, "Bill saved");
  const bills = await jsonOf<{ description: string; isActive: boolean }[]>(await api.get("/api/admin/recurring-bills"));
  expect(bills.find((one) => one.description === bill)?.isActive).toBe(false);

  await page.goto("/dashboard/expenses/suppliers");
  await switchOff(`Edit ${supplier}`, "Supplier saved");
  const suppliers = await jsonOf<{ name: string; isActive: boolean }[]>(await api.get("/api/admin/suppliers?all=true"));
  expect(suppliers.find((one) => one.name === supplier)?.isActive).toBe(false);

  await page.goto("/dashboard/payroll/employees");
  await switchOff(`Edit ${employee}`, "Employee saved");
  const staff = await jsonOf<{ name: string; isActive: boolean }[]>(
    await api.get("/api/admin/payroll/employees?all=true"),
  );
  expect(staff.find((one) => one.name === employee)?.isActive).toBe(false);
  await api.dispose();
});

test("a pay run is voided, and its month is free again", async ({ page }) => {
  const api = await adminApi();
  // Last month: this month's run is the payroll spec's.
  const [, lastMonth] = recentJalaliPeriods(today, 2);
  const { id: employeeId } = await jsonOf<{ id: string }>(
    await api.post("/api/admin/payroll/employees", {
      data: { name: `${TAG} Mina`, position: "Server", phone: "", monthlySalary: "120000000", isActive: true },
    }),
  );
  const run = await jsonOf<{ id: string }>(
    await api.post("/api/admin/payroll/runs", {
      data: {
        period: lastMonth,
        date: today,
        lines: [
          {
            employeeId,
            gross: "120000000",
            employeeInsurance: "8400000",
            incomeTax: "0",
            employerInsurance: "24000000",
          },
        ],
      },
    }),
  );

  await page.goto(`/dashboard/payroll/${run.id}`);
  await page.getByRole("button", { name: "Void", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Reason (optional)").fill("Wrong month");
  await dialog.getByRole("button", { name: "Void pay run" }).click();
  await expect(toast(page, /^Payroll voided for /)).toBeVisible();

  const detail = await jsonOf<{ run: { status: string } }>(await api.get(`/api/admin/payroll/runs/${run.id}`));
  expect(detail.run.status).toBe("void");
  // The month can be run again.
  const again = await api.post("/api/admin/payroll/runs", {
    data: {
      period: lastMonth,
      date: today,
      lines: [
        { employeeId, gross: "120000000", employeeInsurance: "8400000", incomeTax: "0", employerInsurance: "24000000" },
      ],
    },
  });
  expect(again.status()).toBe(201);
  // Leave the books as they were: this one is voided too.
  const second = (await again.json()) as { id: string };
  await jsonOf(await api.post(`/api/admin/payroll/runs/${second.id}/void`, { data: { reason: "" } }));
  await api.dispose();
});
