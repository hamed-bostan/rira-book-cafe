-- AlterTable
ALTER TABLE "products" ADD COLUMN     "target_markup_bps" INTEGER;

-- CreateTable
CREATE TABLE "ingredients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "purchase_price" INTEGER NOT NULL,
    "purchase_quantity" DOUBLE PRECISION NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_lines" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "ingredient_id" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "recipe_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "default_markup_bps" INTEGER NOT NULL DEFAULT 3000,
    "rounding_step" INTEGER NOT NULL DEFAULT 5000,
    "overhead_source" TEXT NOT NULL DEFAULT 'ledger',
    "manual_monthly_overhead" BIGINT,
    "expected_monthly_units" INTEGER,
    "overhead_months" INTEGER NOT NULL DEFAULT 3,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recipe_lines_ingredient_id_idx" ON "recipe_lines"("ingredient_id");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_lines_product_id_ingredient_id_key" ON "recipe_lines"("product_id", "ingredient_id");

-- AddForeignKey
ALTER TABLE "recipe_lines" ADD CONSTRAINT "recipe_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_lines" ADD CONSTRAINT "recipe_lines_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Integrity the app also checks, enforced here too.
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_values_chk"
  CHECK ("unit" IN ('g', 'ml', 'piece') AND "purchase_price" >= 0 AND "purchase_quantity" > 0);

ALTER TABLE "recipe_lines" ADD CONSTRAINT "recipe_lines_quantity_chk" CHECK ("quantity" > 0);

ALTER TABLE "products" ADD CONSTRAINT "products_target_markup_chk"
  CHECK ("target_markup_bps" IS NULL OR "target_markup_bps" BETWEEN 0 AND 100000);

ALTER TABLE "pricing_settings" ADD CONSTRAINT "pricing_settings_values_chk"
  CHECK (
    "id" = 1
    AND "default_markup_bps" BETWEEN 0 AND 100000
    AND "rounding_step" BETWEEN 1 AND 1000000
    AND "overhead_source" IN ('ledger', 'manual')
    AND ("manual_monthly_overhead" IS NULL OR "manual_monthly_overhead" >= 0)
    AND ("expected_monthly_units" IS NULL OR "expected_monthly_units" > 0)
    AND "overhead_months" BETWEEN 1 AND 12
  );
