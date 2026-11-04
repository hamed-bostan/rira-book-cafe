# Dashboard verification checklist (Phase 0 output)

Built 2026-11-04 by reading the code. "Suspect" = looks wrong on reading, **not yet confirmed in the app**.
"Untested" = no integration or e2e test exercises it (unit only, layout-only, or nothing).
Every write route checks a permission; no button without a handler was found.

## Phase 1 — Overview + Service

Suspects

- [x] S1.1 "Unmark paid" works on **online-paid** orders with only `orders.fulfill` — **bug, fixed**.
- [x] S1.2 Bulk actions and payment toggle skip `router.refresh()` on error — **bug, fixed** (also the line served tick).
- [x] S1.3 Overview confirms a booking with no table — by design.
- [x] S1.4 Lint a11y warnings on the row checkboxes — false positives.
- [x] Found while testing: phone search crashed the order list (500), and a phone typed without its spaces found nothing — **bugs, fixed**.

Untested in a browser: status advance (kitchen, overview queue, order page, row menu), tick a line served, mark paid / unmark from row menu and order page, write-off, give back online payment, internal note (route has no test at all), bulk serve/paid/cancel, service filter + sort, `GET /orders/counts`, kitchen lane tabs / full-screen / new-order toasts.

## Phase 2 — Bookings + Library

Suspects

- [x] S2.1 Past events have no Edit link — **bug, fixed** (link shows on both tabs).
- [x] S2.2 Cancel-then-refund is two calls — by design; the refund reports its own failure and the row keeps Refund.

Untested: reservation Complete / undo seat / change table; suite check-out / undo check-in / new stay; event create / edit / delete / image upload / hold tables / cancel sign-up / take ticket payment; hold skip/remove; loan extend + undo; guest message for suite and book loan (no test at all), for order and hold (unit only); `GET /admin/events`, `GET /admin/events/:id`.

## Phase 3 — Menu

Suspects

- [ ] S3.1 Record waste is a write gated on `inventory.view` (`app/api/admin/inventory/waste/route.ts:23`) — documented as intentional; confirm policy.
- [ ] S3.2 e2e uses `/dashboard/activity?entity=order`; real param is `entityType` (`e2e/service-insights-cafe-responsive.spec.ts:288`) → the case tests the unfiltered log.
- [ ] S3.3 Dead `reviewBulkRequestSchema` (`src/contracts/bulk-action-schema.ts:78`) — cleanup only.

Untested: product row on-menu switch, feature/unfeature (row + bulk); category delete-dialog "hide instead"; reorder level; record waste; track all books; count / receive / opening pages (render only); movements CSV; to-order print; review approve/reject/remove reply/delete; promo edit/switch/delete; loyalty guest lookup.

## Phase 4 — Finance A (cash shifts, income, expenses, payroll)

Suspects

- [ ] S4.1 Editing a recurring bill whose supplier/account is inactive silently drops the supplier or fails validation (`expenses/recurring/page.tsx` loads only active ones; `RecurringBillDialog.tsx:131`).
- [ ] S4.2 Shift "expected cash" is windowed by entry `createdAt`, not entry date; card/transfer income and bank payments don't show on the shift cards (`PrismaCashShiftRepository.ts:26,127`).
- [ ] S4.3 Shift close posts a journal entry with only `shifts.manage`; `cashShift` entries can't be reversed.
- [ ] S4.4 Pay-run "settle deductions" link needs `accounting.write`; a payroll-only user is bounced (`PayRunScreen.tsx:199`).
- [ ] S4.5 Voids fail with `ACCOUNT_INACTIVE` once the account was deactivated — reversals also refuse inactive accounts (`writeJournal.ts:74`).

Untested: expense void (e2e), receipt replace/remove on expense page, recurring bill edit/switch off, supplier edit/deactivate (no route test), payroll void, employee edit/deactivate, income/expense filters.

## Phase 5 — Finance B (accounting, pricing)

Suspects

- [ ] S5.1 **Books can be reopened after a year close**: settings let `booksClosedThrough` move back (`LedgerCommands.ts:209`, `AccountingSettingsForm.tsx:138`); year close can't re-run → retained earnings drift.
- [ ] S5.2 **Bank fee/interest postings can't be undone**: unmatch deletes only the match, never reverses the posted entry (`PrismaBankReconciliationRepository.ts:187`) → unmatch + record again double-posts; removing the line orphans the entry.
- [ ] S5.3 Gateway settlement has no `uniqueKey` (`Postings.ts:616`) → double submit double-posts.
- [ ] S5.4 Recipe link shows to view-only users, page needs `accounting.write` (`PricingItemCard.tsx:81`).
- [ ] S5.5 Journal "Print or export" link drops `accountCode` (`JournalScreen.tsx:58`).

Untested at route level: settlements, year close, account create / activate, account ledger, **all bank-statement routes**, pricing markup + apply suggested price, quick journal entry dialog, journal CSV click, default suite price.

## Phase 6 — Insights + Store

Suspects

- [ ] S6.1 `fiscalYearsApi` lives in `inventory-api.ts:85` but is accounting's — misplaced, not broken.
- Two-factor removal: no leftovers found.

Untested: guests report (unit only), mark paid from payments report, most report CSV slugs (only streams in e2e), ownership transfer, single-session sign-out (own + member), change role / remove access (e2e opens the dialog only), role edit/delete in browser, activity clear filters.
