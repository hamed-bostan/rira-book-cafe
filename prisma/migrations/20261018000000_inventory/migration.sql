-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "stock_tracked" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ingredients" ADD COLUMN     "average_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "on_hand" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "reorder_level" DOUBLE PRECISION,
ADD COLUMN     "stock_value" BIGINT NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "ingredient_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "value" BIGINT NOT NULL,
    "date" DATE NOT NULL,
    "reference_id" TEXT,
    "note" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_movements_ingredient_id_date_idx" ON "stock_movements"("ingredient_id", "date");

-- CreateIndex
CREATE INDEX "stock_movements_reference_id_idx" ON "stock_movements"("reference_id");

-- CreateIndex
CREATE INDEX "stock_movements_date_idx" ON "stock_movements"("date");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Stock movements are a record, like the journal: never edited or deleted.
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_values_chk"
  CHECK (
    "kind" IN ('opening', 'receipt', 'sale', 'waste', 'count')
    AND "quantity" <> 0
    -- Value moves with quantity (a zero-cost item can move at zero value).
    AND ("value" = 0 OR sign("value") = sign("quantity"))
  );

CREATE OR REPLACE FUNCTION stock_movements_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Stock movements are permanent; record a correcting movement instead';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "stock_movements_immutable"
  BEFORE UPDATE OR DELETE ON "stock_movements"
  FOR EACH ROW EXECUTE FUNCTION stock_movements_immutable();

ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_reorder_level_chk"
  CHECK ("reorder_level" IS NULL OR "reorder_level" >= 0);

-- Where inventory losses land on the P&L.
INSERT INTO "ledger_accounts" ("code", "name", "name_fa", "type", "is_system") VALUES
  ('5200', 'Waste and spoilage',  'ضایعات و فساد کالا',  'expense', true),
  ('5300', 'Inventory variance',  'مغایرت انبارگردانی',   'expense', true);
