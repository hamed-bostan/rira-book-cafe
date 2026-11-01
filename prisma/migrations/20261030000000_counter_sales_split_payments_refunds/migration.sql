-- Counter sales: staff ring up a guest who has no account, so an order's user is optional.
ALTER TABLE "orders" ALTER COLUMN "user_id" DROP NOT NULL;

-- Split payments: an order's money by method. The parts add up to its total.
CREATE TABLE "order_payment_parts" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "order_payment_parts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_payment_parts_order_id_idx" ON "order_payment_parts"("order_id");
CREATE INDEX "order_payment_parts_method_idx" ON "order_payment_parts"("method");

ALTER TABLE "order_payment_parts" ADD CONSTRAINT "order_payment_parts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_payment_parts" ADD CONSTRAINT "order_payment_parts_amount_chk"
  CHECK ("amount" >= 0 AND "method" IN ('cash', 'card', 'transfer', 'online'));

-- Every order already paid was paid in one go.
INSERT INTO "order_payment_parts" ("id", "order_id", "method", "amount", "position")
SELECT gen_random_uuid()::text, "id", "payment_method", "total", 0
FROM "orders"
WHERE "payment_method" IS NOT NULL AND "payment_status" IN ('paid', 'refunded');

-- Refunds on completed orders: the running totals, and the documents behind them.
ALTER TABLE "orders" ADD COLUMN "refunded_total" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "order_items" ADD COLUMN "refunded_quantity" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "orders" ADD CONSTRAINT "orders_refunded_total_chk"
  CHECK ("refunded_total" >= 0 AND "refunded_total" <= "total");
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_refunded_quantity_chk"
  CHECK ("refunded_quantity" >= 0 AND "refunded_quantity" <= "quantity");

CREATE TABLE "order_refunds" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "order_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "method" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "vat_amount" INTEGER NOT NULL,
    "reason" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_refunds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_refund_lines" (
    "id" TEXT NOT NULL,
    "refund_id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "vat_amount" INTEGER NOT NULL,
    "restocked" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,

    CONSTRAINT "order_refund_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "order_refunds_number_key" ON "order_refunds"("number");
CREATE INDEX "order_refunds_order_id_idx" ON "order_refunds"("order_id");
CREATE INDEX "order_refund_lines_refund_id_idx" ON "order_refund_lines"("refund_id");
CREATE INDEX "order_refund_lines_order_item_id_idx" ON "order_refund_lines"("order_item_id");

ALTER TABLE "order_refunds" ADD CONSTRAINT "order_refunds_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_refund_lines" ADD CONSTRAINT "order_refund_lines_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "order_refunds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_refund_lines" ADD CONSTRAINT "order_refund_lines_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "order_refunds" ADD CONSTRAINT "order_refunds_amounts_chk"
  CHECK ("amount" > 0 AND "vat_amount" >= 0 AND "vat_amount" < "amount");
ALTER TABLE "order_refund_lines" ADD CONSTRAINT "order_refund_lines_amounts_chk"
  CHECK ("quantity" > 0 AND "amount" >= 0 AND "vat_amount" >= 0);

-- Goods handed back come into stock as a `return` movement.
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_values_chk";
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_values_chk"
  CHECK (
    "kind" IN ('opening', 'receipt', 'sale', 'waste', 'count', 'return')
    AND "quantity" <> 0
    -- Value moves with quantity (a zero-cost item can move at zero value).
    AND ("value" = 0 OR sign("value") = sign("quantity"))
  );
