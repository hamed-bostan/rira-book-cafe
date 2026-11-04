-- Options on menu items (sizes, extras) and the choices an order line snapshots.
-- Adds tables and a column only: items without groups and existing order lines
-- (whose options read as `[]`) behave exactly as before.

-- CreateTable
CREATE TABLE "product_option_groups" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_fa" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "selection" TEXT NOT NULL DEFAULT 'single',
    "min_choices" INTEGER NOT NULL DEFAULT 0,
    "max_choices" INTEGER,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_option_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_option_choices" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_fa" TEXT,
    "price_delta" INTEGER NOT NULL DEFAULT 0,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_option_choices_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN "options" JSONB NOT NULL DEFAULT '[]';

-- CreateIndex
CREATE INDEX "product_option_groups_product_id_position_idx" ON "product_option_groups"("product_id", "position");

-- CreateIndex
CREATE INDEX "product_option_choices_group_id_position_idx" ON "product_option_choices"("group_id", "position");

-- AddForeignKey
ALTER TABLE "product_option_groups" ADD CONSTRAINT "product_option_groups_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_option_choices" ADD CONSTRAINT "product_option_choices_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "product_option_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
