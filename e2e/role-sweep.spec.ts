import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { ROLE_PERMISSIONS, type Permission } from "../src/domain/entities/Permission";

import { E2E_BASE_URL } from "./fixtures/env";
import { storageStatePath } from "./fixtures/sessions";

/**
 * Every dashboard page, opened as every role that has a sign-in here. A page the role
 * may use renders without the error boundary — so no data it loads needs more than
 * the page asks for; a page it may not use sends it away instead of failing.
 *
 * The pages and what each needs are read from the code itself (the sidebar's
 * sections and each page's own guard), so a new page is swept without a list to keep.
 */

const ROOT = join(__dirname, "..");
const PAGES_DIR = join(ROOT, "app", "[locale]", "(protected)");

/** The sidebar's sections: each one's href. */
function sectionHrefs(): string[] {
  const source = readFileSync(join(ROOT, "src", "presentation", "dashboard", "shell", "sections.ts"), "utf8");
  return [...source.matchAll(/href:\s*"([^"]+)"/g)].map((match) => match[1]);
}

/** Pages under the sections that are reached from them, not from the sidebar. */
const SUB_PAGES = [
  "/dashboard/security",
  "/dashboard/accounting/journal",
  "/dashboard/accounting/journal/new",
  "/dashboard/accounting/accounts",
  "/dashboard/accounting/statements",
  "/dashboard/accounting/bank",
  "/dashboard/accounting/settings",
  "/dashboard/expenses/recurring",
  "/dashboard/expenses/suppliers",
  "/dashboard/payroll/employees",
  "/dashboard/pricing/ingredients",
  "/dashboard/pricing/settings",
  "/dashboard/inventory/movements",
  "/dashboard/inventory/to-order",
  "/dashboard/inventory/returns",
  "/dashboard/inventory/count",
  "/dashboard/reports/guests",
  "/dashboard/reports/payments",
  "/dashboard/orders/new",
];

/** What a page asks for: its own guard, or just the dashboard when the layout's is all it has. */
function pageNeeds(href: string): Permission | "owner" {
  const source = readFileSync(join(PAGES_DIR, ...href.split("/").filter(Boolean), "page.tsx"), "utf8");
  if (/requireOwner\(/.test(source)) return "owner";
  const guard = /requirePermission\(\s*"([a-z.]+)"\s*\)/.exec(source);
  return (guard?.[1] as Permission | undefined) ?? "dashboard.view";
}

const PAGES = [...new Set([...sectionHrefs(), ...SUB_PAGES])].map((href) => ({ href, needs: pageNeeds(href) }));

const ROLES = ["owner", "admin", "staff"] as const;

for (const role of ROLES) {
  test.describe(`as ${role}`, () => {
    test.use({ storageState: storageStatePath(role) });

    for (const { href, needs } of PAGES) {
      const allowed = needs === "owner" ? role === "owner" : ROLE_PERMISSIONS[role].includes(needs);

      test(`${allowed ? "opens" : "is sent away from"} ${href}`, async ({ page }) => {
        const response = await page.goto(href);
        expect(response?.status() ?? 0).toBeLessThan(500);
        await expect(page.getByRole("heading", { name: "Something went wrong" })).toHaveCount(0);
        if (allowed) {
          expect(new URL(page.url()).pathname).toBe(href);
          await expect(page.getByRole("main")).toBeVisible();
        } else {
          // The refusal is a redirect issued while the page streams, so the URL moves a moment after load.
          await expect.poll(() => new URL(page.url()).pathname).not.toBe(href);
          await expect(page.getByRole("heading", { name: "Something went wrong" })).toHaveCount(0);
        }
      });
    }
  });
}

/** A message key on screen instead of its text: what next-intl shows for a missing translation. */
const RAW_KEY = /\b(?:dash[A-Z]\w*|apiErrors|formErrors|dashboard)\.[a-z]\w*(?:\.\w+)*\b/;

for (const locale of ["en", "fa"] as const) {
  test.describe(`in ${locale}`, () => {
    test.use({ storageState: storageStatePath("owner") });

    for (const { href } of PAGES) {
      test(`${href} renders without an error or a missing translation`, async ({ page, context }) => {
        await context.addCookies([{ name: "NEXT_LOCALE", value: locale, url: E2E_BASE_URL }]);
        const response = await page.goto(href);
        expect(response?.status() ?? 0).toBeLessThan(500);
        await expect(page.getByRole("main")).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.getByRole("heading", { name: /^(Something went wrong|مشکلی پیش آمد)$/ })).toHaveCount(0);
        expect(await page.getByRole("main").innerText()).not.toMatch(RAW_KEY);
      });
    }
  });
}
