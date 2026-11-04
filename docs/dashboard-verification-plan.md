# Dashboard verification plan

Goal: confirm every feature the dashboard already has works correctly. **No new features.**
Anything missing is only listed at the end, never built. Bugs are fixed, each with a regression test.

## How each phase runs

1. **Inventory** — read the section's screens, route handlers and use-cases; write down every action a
   user can take (create / edit / cancel / refund / filter / print / export …).
2. **Coverage check** — map each action to existing unit / integration / e2e tests; note the gaps.
3. **Exercise in the real app** — production build against the seeded test DB (never `next dev`),
   driven by Playwright (Chrome channel). For each action: happy path, validation errors, empty state,
   wrong role (403/401), Persian locale + RTL, phone width.
4. **Data checks** — after each action, the numbers it touches elsewhere agree (stock, income,
   journal, reports, guest profile).
5. **Fix** — bugs only, smallest change, one regression test each. Product decisions are asked, not guessed.
6. **Gate** — typecheck, lint, unit, the phase's integration + e2e specs; merge into `main` locally, no push.

## Phases

| #   | Phase              | Pages                                                                                                                                                                                                                                                                           |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Baseline           | Full suite (typecheck, lint, unit, integration, e2e) on current `main`; record failures and flakes; build the action checklist for all phases                                                                                                                                   |
| 1   | Overview + Service | `/dashboard`, orders (list, new, detail, edits, receipt, payments, refunds), kitchen                                                                                                                                                                                            |
| 2   | Bookings + Library | reservations, suite, events, book loans, book holds; deposits, refunds, rescheduling, guest messages                                                                                                                                                                            |
| 3   | Menu               | products + options, categories (nesting), inventory (receive, count, opening, movements, returns, to-order), reviews, promotions                                                                                                                                                |
| 4   | Finance A          | cash shifts, income, expenses (receipts, recurring bills, suppliers), payroll (employees, runs)                                                                                                                                                                                 |
| 5   | Finance B          | accounting (journal, print, accounts, bank, statements, settings), pricing (ingredients, recipes, settings)                                                                                                                                                                     |
| 6   | Insights + Store   | reports (sales, guests, payments), activity, team + roles, security (after the 2FA removal), settings                                                                                                                                                                           |
| 7   | Cross-checks       | One full "business day" scenario: open shift → orders → refund → booking deposit → expense → payroll → close shift; then reports = income = accounting, stock movements = recipes. Role sweep: every role sees only its sections and APIs refuse the rest. Locale sweep (fa/en) |
| 8   | Wrap-up            | Full suite once on the merged result; report: bugs fixed, open questions, missing pieces (not built)                                                                                                                                                                            |

## Log

_Filled in as phases finish: bugs found, fix commit, test added._

### Phase 0 — baseline (2026-11-04, `main` @ d062eab)

| Check        | Result                                                                                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| typecheck    | pass                                                                                                                                                              |
| lint         | 0 errors, 6 warnings (a11y: `OrderRow.tsx:42`, `OrdersTable.tsx:71`, `BulkRowCheckbox.tsx:32`; `OtpScreen.tsx:112` autofocus; a console call in the token script) |
| unit         | 1975 passed, 1 expected fail (196 files)                                                                                                                          |
| integration  | 508 passed (50 files)                                                                                                                                             |
| e2e (Chrome) | 737 passed, 1 failed, 2 did not run (27.7 min)                                                                                                                    |

- The e2e failure is a **test-suite flake, not a product bug**: `product-options.spec.ts:85`, where a guest places an order, got "Too many attempts". The shared guest test user ran into the order rate limit after earlier specs; the spec passes alone (5/5). Fix in Phase 1: give the spec its own guest, so suite order can't trip it.
- Action checklist, suspects and untested actions per phase: [dashboard-verification-checklist.md](dashboard-verification-checklist.md).

### Phase 1 — Overview + Service (2026-11-04)

Bugs fixed (each with a regression test):

1. **An online payment could be unmarked by floor staff.** "Unmark" on an online-paid order reversed the gateway's booking while the payment stayed captured, so the money left the books _and_ the give-back list. Now refused (409) in `SetOrderPayment`, and the button is hidden for online payments; giving it back is a refund (`accounting.write`). Tests: `RefundOrder.test.ts`, `online-payments.integration.test.ts`.
2. **Searching the order list by a phone number crashed it (500).** An all-digit query was also tried as an order number and overflowed the integer column. Order numbers are now at most 9 digits, as income and expenses already do. Test: `order-service.integration.test.ts`.
3. **A phone typed differently from how it was entered found nothing.** "09125550141" didn't find an order rung up as "0912 555 0141". The search now also matches the guest profile by normalized phone. Test: `order-service.integration.test.ts`.
4. **Three controls said "showing its current state" after a conflict but didn't reload**: the order page's payment toggle, a line's served tick and the bulk bar. They now `router.refresh()` on error, like the row menu.
5. **Test flake**: `order-changes` placed six orders as the shared test guest and used up its 10-per-10-minutes allowance before `product-options` ran. Those orders are now counter sales; only the guest's own-receipt test orders as the guest.

Not bugs: the overview confirms a booking without a table by design (only seating needs one); the lint a11y warnings on the row checkboxes are false positives (Radix button with its own `aria-label` inside a hit-area label).

New coverage: `e2e/service-actions.spec.ts` (bar display start / tick / serve; order page advance, tick a line, pay + unmark, note; row menu; bulk serve / pay / cancel; service filter, clear all, sort by total; write-off) and `tests/integration/order-service.integration.test.ts` (notes route, bulk route, counts, phone search). Still covered only by API tests: the overview queue's step button (the queue shows the oldest open orders, so a test's new order may not be in it).

Gate: typecheck pass; lint 0 errors; unit 1976 passed; integration 518 passed; e2e (Chrome) 746 passed, 0 failed.
