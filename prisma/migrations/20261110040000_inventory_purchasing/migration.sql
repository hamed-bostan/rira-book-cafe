-- Inventory: purchase units, par levels and a usual supplier per stock item;
-- reason-coded adjustments; stock sent back to suppliers.

-- AlterTable
ALTER TABLE "ingredients" ADD COLUMN     "par_level" DOUBLE PRECISION,
ADD COLUMN     "purchase_units" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "supplier_id" TEXT;

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "reason" TEXT;

-- CreateTable
CREATE TABLE "supplier_returns" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "supplier_name" TEXT NOT NULL,
    "expense_id" TEXT,
    "credit_amount" BIGINT NOT NULL,
    "vat_amount" BIGINT NOT NULL DEFAULT 0,
    "applied_amount" BIGINT NOT NULL DEFAULT 0,
    "refunded_amount" BIGINT NOT NULL DEFAULT 0,
    "refunded_to" TEXT,
    "stock_value" BIGINT NOT NULL,
    "note" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_returns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "supplier_returns_number_key" ON "supplier_returns"("number");

-- CreateIndex
CREATE INDEX "supplier_returns_supplier_id_idx" ON "supplier_returns"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_returns_expense_id_idx" ON "supplier_returns"("expense_id");

-- AddForeignKey
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_returns" ADD CONSTRAINT "supplier_returns_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_returns" ADD CONSTRAINT "supplier_returns_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_par_level_chk"
  CHECK ("par_level" IS NULL OR "par_level" >= 0);

ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_purchase_units_chk"
  CHECK (jsonb_typeof("purchase_units") = 'array');

-- The two new kinds: a reason-coded adjustment, and stock sent back to a supplier.
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_values_chk";
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_values_chk"
  CHECK (
    "kind" IN ('opening', 'receipt', 'sale', 'waste', 'count', 'return', 'adjustment', 'return_to_supplier')
    AND "quantity" <> 0
    -- Value moves with quantity (a zero-cost item can move at zero value).
    AND ("value" = 0 OR sign("value") = sign("quantity"))
    -- An adjustment always says why; nothing else carries a reason.
    AND (("kind" = 'adjustment') = ("reason" IS NOT NULL))
  );

-- A credit note is split between the bill it settles and money given back, and
-- never credits more than it says.
ALTER TABLE "supplier_returns" ADD CONSTRAINT "supplier_returns_amounts_chk"
  CHECK (
    "credit_amount" >= 0
    AND "vat_amount" >= 0
    AND "vat_amount" <= "credit_amount"
    AND "applied_amount" >= 0
    AND "refunded_amount" >= 0
    AND "applied_amount" + "refunded_amount" = "credit_amount"
    AND ("refunded_amount" = 0 OR "refunded_to" IN ('cash', 'bank'))
    AND "stock_value" >= 0
  );

-- Where a staff meal and a tasting land: running costs, not cost of sales (see
-- ADJUSTMENT_ACCOUNTS in src/domain/entities/Inventory.ts).
INSERT INTO "ledger_accounts" ("code", "name", "name_fa", "type", "is_system") VALUES
  ('6410', 'Staff meals',           'غذای کارکنان',          'expense', true),
  ('6610', 'Samples and tastings',  'نمونه و تست محصول',     'expense', true)
ON CONFLICT ("code") DO UPDATE SET "is_system" = true;
