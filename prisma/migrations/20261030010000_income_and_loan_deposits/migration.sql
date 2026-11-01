-- Income outside orders: event tickets, suite stays, anything else that comes in.
CREATE TABLE "incomes" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "account_code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "vat_amount" BIGINT NOT NULL DEFAULT 0,
    "method" TEXT NOT NULL,
    "payer_name" TEXT,
    "source_type" TEXT,
    "source_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'received',
    "created_by_id" TEXT NOT NULL,
    "created_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incomes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "incomes_number_key" ON "incomes"("number");
CREATE INDEX "incomes_date_idx" ON "incomes"("date");
CREATE INDEX "incomes_status_idx" ON "incomes"("status");
CREATE INDEX "incomes_source_type_source_id_idx" ON "incomes"("source_type", "source_id");

ALTER TABLE "incomes" ADD CONSTRAINT "incomes_account_code_fkey" FOREIGN KEY ("account_code") REFERENCES "ledger_accounts"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "incomes" ADD CONSTRAINT "incomes_amounts_chk"
  CHECK ("amount" > 0 AND "vat_amount" >= 0 AND "vat_amount" < "amount");
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_status_chk"
  CHECK ("status" IN ('received', 'void'));
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_method_chk"
  CHECK ("method" IN ('cash', 'card', 'transfer'));

-- Deposits left against a borrowed book: the cafe's to hold, not to earn.
ALTER TABLE "book_loans"
  ADD COLUMN "deposit_amount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "deposit_method" TEXT,
  ADD COLUMN "deposit_state" TEXT;

ALTER TABLE "book_loans" ADD CONSTRAINT "book_loans_deposit_chk"
  CHECK (
    "deposit_amount" >= 0
    AND ("deposit_amount" = 0) = ("deposit_method" IS NULL)
    AND ("deposit_amount" = 0) = ("deposit_state" IS NULL)
    AND ("deposit_method" IS NULL OR "deposit_method" IN ('cash', 'bank'))
    AND ("deposit_state" IS NULL OR "deposit_state" IN ('held', 'returned', 'kept'))
  );

INSERT INTO "ledger_accounts" ("code", "name", "name_fa", "type", "is_system") VALUES
  ('2400', 'Deposits held',  'ودیعه‌های دریافتی',  'liability', true),
  ('4400', 'Event tickets',  'فروش بلیت رویداد',  'revenue',   true),
  ('4500', 'Suite stays',    'درآمد اقامت سوئیت', 'revenue',   true)
ON CONFLICT ("code") DO UPDATE SET "is_system" = true;

-- A deposit kept for a lost book lands here, so it can no longer be switched off.
UPDATE "ledger_accounts" SET "is_system" = true, "is_active" = true WHERE "code" = '4900';
