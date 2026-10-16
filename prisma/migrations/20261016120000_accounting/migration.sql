-- AlterTable
ALTER TABLE "products" ADD COLUMN     "cost_price" INTEGER;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "payment_method" TEXT;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "tax_exempt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "unit_cost" INTEGER;

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "tax_exempt" SET DEFAULT false;

-- CreateTable
CREATE TABLE "ledger_accounts" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_fa" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "source_id" TEXT,
    "unique_key" TEXT,
    "reverses_id" TEXT,
    "reversed_by_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_lines" (
    "id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "account_code" TEXT NOT NULL,
    "debit" BIGINT NOT NULL DEFAULT 0,
    "credit" BIGINT NOT NULL DEFAULT 0,
    "memo" TEXT,
    "position" INTEGER NOT NULL,

    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "vat_rate_bps" INTEGER NOT NULL DEFAULT 1000,
    "books_closed_through" DATE,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "note" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "supplier_id" TEXT,
    "supplier_name" TEXT,
    "account_code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "vat_amount" BIGINT NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "paid_from" TEXT,
    "paid_on" DATE,
    "receipt_url" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_number_key" ON "journal_entries"("number");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_unique_key_key" ON "journal_entries"("unique_key");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_reverses_id_key" ON "journal_entries"("reverses_id");

-- CreateIndex
CREATE INDEX "journal_entries_date_idx" ON "journal_entries"("date");

-- CreateIndex
CREATE INDEX "journal_entries_source_source_id_idx" ON "journal_entries"("source", "source_id");

-- CreateIndex
CREATE INDEX "journal_lines_entry_id_idx" ON "journal_lines"("entry_id");

-- CreateIndex
CREATE INDEX "journal_lines_account_code_idx" ON "journal_lines"("account_code");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_number_key" ON "expenses"("number");

-- CreateIndex
CREATE INDEX "expenses_date_idx" ON "expenses"("date");

-- CreateIndex
CREATE INDEX "expenses_status_idx" ON "expenses"("status");

-- CreateIndex
CREATE INDEX "expenses_supplier_id_idx" ON "expenses"("supplier_id");

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_account_code_fkey" FOREIGN KEY ("account_code") REFERENCES "ledger_accounts"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_account_code_fkey" FOREIGN KEY ("account_code") REFERENCES "ledger_accounts"("code") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ── Database-level guarantees ─────────────────────────────────────────────────
-- The app validates all of this too; these make it impossible for any code path
-- (or a hand-written SQL statement) to leave the books inconsistent.

-- A line is one positive amount, on one side.
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_one_side_chk"
  CHECK ("debit" >= 0 AND "credit" >= 0 AND (("debit" > 0) <> ("credit" > 0)));

ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_type_chk"
  CHECK ("type" IN ('asset', 'liability', 'equity', 'revenue', 'expense'));

ALTER TABLE "expenses" ADD CONSTRAINT "expenses_amounts_chk"
  CHECK ("amount" > 0 AND "vat_amount" >= 0 AND "vat_amount" < "amount");

ALTER TABLE "expenses" ADD CONSTRAINT "expenses_status_chk"
  CHECK ("status" IN ('unpaid', 'paid', 'void'));

ALTER TABLE "accounting_settings" ADD CONSTRAINT "accounting_settings_singleton_chk"
  CHECK ("id" = 1 AND "vat_rate_bps" BETWEEN 0 AND 5000);

-- Every entry balances: checked at COMMIT (deferred), once all its lines exist.
CREATE FUNCTION "journal_entry_balanced"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  total_debit  BIGINT;
  total_credit BIGINT;
  line_count   INTEGER;
BEGIN
  SELECT COALESCE(SUM("debit"), 0), COALESCE(SUM("credit"), 0), COUNT(*)
    INTO total_debit, total_credit, line_count
    FROM "journal_lines" WHERE "entry_id" = NEW."entry_id";
  IF line_count < 2 OR total_debit <> total_credit THEN
    RAISE EXCEPTION 'Journal entry % is unbalanced (debits %, credits %, lines %)',
      NEW."entry_id", total_debit, total_credit, line_count;
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "journal_lines_balanced"
  AFTER INSERT ON "journal_lines"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "journal_entry_balanced"();

-- Posted lines are never edited or deleted; corrections are reversing entries.
CREATE FUNCTION "journal_lines_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Journal lines are immutable; post a reversing entry instead';
END;
$$;

CREATE TRIGGER "journal_lines_no_update_delete"
  BEFORE UPDATE OR DELETE ON "journal_lines"
  FOR EACH ROW EXECUTE FUNCTION "journal_lines_immutable"();

-- Entries can't be deleted, and the only change allowed after posting is
-- recording, once, which entry reversed it.
CREATE FUNCTION "journal_entries_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Journal entries are permanent; post a reversing entry instead';
  END IF;
  IF OLD."reversed_by_id" IS NOT NULL
     OR NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."number" IS DISTINCT FROM OLD."number"
     OR NEW."date" IS DISTINCT FROM OLD."date"
     OR NEW."description" IS DISTINCT FROM OLD."description"
     OR NEW."source" IS DISTINCT FROM OLD."source"
     OR NEW."source_id" IS DISTINCT FROM OLD."source_id"
     OR NEW."unique_key" IS DISTINCT FROM OLD."unique_key"
     OR NEW."reverses_id" IS DISTINCT FROM OLD."reverses_id"
     OR NEW."created_by_id" IS DISTINCT FROM OLD."created_by_id"
     OR NEW."created_by_name" IS DISTINCT FROM OLD."created_by_name"
     OR NEW."created_at" IS DISTINCT FROM OLD."created_at" THEN
    RAISE EXCEPTION 'Journal entry % is immutable', OLD."id";
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "journal_entries_guard"
  BEFORE UPDATE OR DELETE ON "journal_entries"
  FOR EACH ROW EXECUTE FUNCTION "journal_entries_guard"();

-- ── Starting data ─────────────────────────────────────────────────────────────

INSERT INTO "accounting_settings" ("id", "vat_rate_bps", "updated_at") VALUES (1, 1000, CURRENT_TIMESTAMP);

INSERT INTO "ledger_accounts" ("code", "name", "name_fa", "type", "is_system") VALUES
  ('1110', 'Cash on hand',                'صندوق (وجه نقد)',                 'asset',     true),
  ('1120', 'Bank account',                'حساب بانکی',                      'asset',     true),
  ('1130', 'Payment gateway clearing',    'حساب واسط درگاه پرداخت',          'asset',     true),
  ('1150', 'Guest receivables',           'حساب‌های دریافتنی مهمانان',        'asset',     true),
  ('1200', 'Inventory',                   'موجودی کالا',                     'asset',     true),
  ('1500', 'Equipment',                   'تجهیزات',                         'asset',     false),
  ('2100', 'Accounts payable',            'حساب‌های پرداختنی',               'liability', true),
  ('2200', 'VAT payable',                 'مالیات بر ارزش افزوده پرداختنی',  'liability', true),
  ('2300', 'Salaries payable',            'حقوق پرداختنی',                   'liability', false),
  ('3100', 'Owner''s capital',            'سرمایه',                          'equity',    true),
  ('3200', 'Retained earnings',           'سود انباشته',                     'equity',    true),
  ('3300', 'Owner''s drawings',           'برداشت مالک',                     'equity',    false),
  ('4100', 'Sales — drinks',              'فروش نوشیدنی',                    'revenue',   true),
  ('4200', 'Sales — food',                'فروش غذا',                        'revenue',   true),
  ('4300', 'Sales — books',               'فروش کتاب',                       'revenue',   true),
  ('4900', 'Other income',                'سایر درآمدها',                    'revenue',   false),
  ('5100', 'Cost of sales',               'بهای تمام‌شدهٔ کالای فروش‌رفته',   'expense',   true),
  ('6100', 'Rent',                        'اجاره',                           'expense',   false),
  ('6200', 'Salaries and wages',          'حقوق و دستمزد',                   'expense',   false),
  ('6300', 'Utilities',                   'آب، برق و گاز',                   'expense',   false),
  ('6400', 'Supplies and consumables',    'ملزومات مصرفی',                   'expense',   false),
  ('6500', 'Repairs and maintenance',     'تعمیر و نگهداری',                 'expense',   false),
  ('6600', 'Marketing',                   'تبلیغات',                         'expense',   false),
  ('6700', 'Bank and gateway fees',       'کارمزد بانک و درگاه',             'expense',   false),
  ('6900', 'Other expenses',              'سایر هزینه‌ها',                   'expense',   false);
