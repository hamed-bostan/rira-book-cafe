-- A bill can be paid off in parts: how much of it is paid so far. Each payment is an
-- `expensePayment` journal entry on the expense, so that's the history.
ALTER TABLE "expenses" ADD COLUMN "paid_amount" BIGINT NOT NULL DEFAULT 0;

UPDATE "expenses" SET "paid_amount" = "amount" WHERE "status" = 'paid';

ALTER TABLE "expenses" ADD CONSTRAINT "expenses_paid_amount_chk"
  CHECK ("paid_amount" >= 0 AND "paid_amount" <= "amount");
