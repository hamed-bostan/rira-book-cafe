-- Bills that come round every Persian month: rent, internet, a service contract.
-- Nothing is booked from these on its own; each month is put in front of someone.
CREATE TABLE "recurring_bills" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "account_code" TEXT NOT NULL,
    "supplier_id" TEXT,
    "amount" BIGINT NOT NULL,
    "vat_amount" BIGINT NOT NULL DEFAULT 0,
    "day_of_month" INTEGER NOT NULL,
    "starts_on" DATE NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_bills_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "recurring_bills_day_chk" CHECK ("day_of_month" BETWEEN 1 AND 31),
    CONSTRAINT "recurring_bills_amount_chk" CHECK ("amount" > 0 AND "vat_amount" >= 0 AND "vat_amount" < "amount")
);

-- A month of a bill that's been dealt with. The primary key is what stops a month
-- being booked twice: this row commits in the expense's own transaction.
CREATE TABLE "recurring_bill_runs" (
    "bill_id" TEXT NOT NULL,
    -- The Persian month, "1405-08".
    "period" TEXT NOT NULL,
    -- The expense it became; null when the month was skipped.
    "expense_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_bill_runs_pkey" PRIMARY KEY ("bill_id", "period")
);

CREATE UNIQUE INDEX "recurring_bill_runs_expense_id_key" ON "recurring_bill_runs"("expense_id");

ALTER TABLE "recurring_bills" ADD CONSTRAINT "recurring_bills_account_code_fkey"
  FOREIGN KEY ("account_code") REFERENCES "ledger_accounts"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recurring_bills" ADD CONSTRAINT "recurring_bills_supplier_id_fkey"
  FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recurring_bill_runs" ADD CONSTRAINT "recurring_bill_runs_bill_id_fkey"
  FOREIGN KEY ("bill_id") REFERENCES "recurring_bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recurring_bill_runs" ADD CONSTRAINT "recurring_bill_runs_expense_id_fkey"
  FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
