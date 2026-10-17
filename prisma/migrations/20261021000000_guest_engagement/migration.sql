-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "points_discount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "points_earned" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "points_redeemed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "promo_code" TEXT,
ADD COLUMN     "promo_code_id" TEXT,
ADD COLUMN     "promo_discount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "link" TEXT,
    "dedupe_key" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_reviews" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "author_name" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "moderated_by_id" TEXT,
    "moderated_by_name" TEXT,
    "moderated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_waitlist" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "book_title" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "guest_name" TEXT NOT NULL,
    "guest_phone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "book_waitlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "kind" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "max_discount" INTEGER,
    "min_subtotal" INTEGER NOT NULL DEFAULT 0,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "usage_limit" INTEGER,
    "per_guest_limit" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "order_id" TEXT,
    "order_number" INTEGER,
    "note" TEXT,
    "dedupe_key" TEXT,
    "created_by_id" TEXT,
    "created_by_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "toman_per_point" INTEGER NOT NULL DEFAULT 10000,
    "point_value" INTEGER NOT NULL DEFAULT 1000,
    "min_redeem_points" INTEGER NOT NULL DEFAULT 50,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_shifts" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "opened_by_id" TEXT NOT NULL,
    "opened_by_name" TEXT NOT NULL,
    "opening_float" INTEGER NOT NULL,
    "closed_at" TIMESTAMP(3),
    "closed_by_id" TEXT,
    "closed_by_name" TEXT,
    "expected_cash" INTEGER,
    "counted_cash" INTEGER,
    "difference" INTEGER,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "notifications"("dedupe_key");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "product_reviews_status_created_at_idx" ON "product_reviews"("status", "created_at");

-- CreateIndex
CREATE INDEX "product_reviews_product_id_status_created_at_idx" ON "product_reviews"("product_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "product_reviews_product_id_user_id_key" ON "product_reviews"("product_id", "user_id");

-- CreateIndex
CREATE INDEX "book_waitlist_product_id_status_created_at_idx" ON "book_waitlist"("product_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "book_waitlist_user_id_created_at_idx" ON "book_waitlist"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_transactions_dedupe_key_key" ON "loyalty_transactions"("dedupe_key");

-- CreateIndex
CREATE INDEX "loyalty_transactions_user_id_created_at_idx" ON "loyalty_transactions"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "cash_shifts_number_key" ON "cash_shifts"("number");

-- CreateIndex
CREATE INDEX "cash_shifts_opened_at_idx" ON "cash_shifts"("opened_at");

-- CreateIndex
CREATE INDEX "orders_promo_code_id_idx" ON "orders"("promo_code_id");



-- ── Orders: discounts ───────────────────────────────────────────────────────

-- What the guest pays is the lines less the promo and the points, never below zero.
ALTER TABLE "orders" ADD CONSTRAINT "orders_discounts_chk"
  CHECK (
    "promo_discount" >= 0
    AND "points_redeemed" >= 0
    AND "points_discount" >= 0
    AND "points_earned" >= 0
    AND "total" = "subtotal" - "promo_discount" - "points_discount"
    AND "total" >= 0
  );

-- ── Notifications ───────────────────────────────────────────────────────────

-- The unread badge's query.
CREATE INDEX "notifications_user_id_unread_idx" ON "notifications"("user_id") WHERE "read_at" IS NULL;

-- ── Reviews ─────────────────────────────────────────────────────────────────

ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_values_chk"
  CHECK (
    "status" IN ('pending', 'approved', 'rejected')
    AND "rating" BETWEEN 1 AND 5
  );

-- ── Book waitlist ───────────────────────────────────────────────────────────

ALTER TABLE "book_waitlist" ADD CONSTRAINT "book_waitlist_values_chk"
  CHECK (
    "status" IN ('waiting', 'notified', 'fulfilled', 'cancelled')
    -- A guest who was told the book is back says when.
    AND ("status" <> 'notified' OR "notified_at" IS NOT NULL)
  );

-- A guest is in the queue for a book at most once at a time.
CREATE UNIQUE INDEX "book_waitlist_one_open_per_guest" ON "book_waitlist"("product_id", "user_id")
  WHERE "status" IN ('waiting', 'notified');

-- ── Promo codes ─────────────────────────────────────────────────────────────

ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_values_chk"
  CHECK (
    "kind" IN ('percent', 'fixed')
    AND "code" = upper("code")
    AND "value" > 0
    AND ("kind" <> 'percent' OR "value" <= 100)
    AND ("max_discount" IS NULL OR "max_discount" > 0)
    AND "min_subtotal" >= 0
    AND ("usage_limit" IS NULL OR "usage_limit" > 0)
    AND ("per_guest_limit" IS NULL OR "per_guest_limit" > 0)
    AND ("starts_at" IS NULL OR "ends_at" IS NULL OR "ends_at" > "starts_at")
  );

-- ── Loyalty ─────────────────────────────────────────────────────────────────

ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_values_chk"
  CHECK (
    "delta" <> 0
    AND "reason" IN ('earn', 'redeem', 'refund', 'adjust')
    AND ("reason" NOT IN ('earn', 'refund') OR "delta" > 0)
    AND ("reason" <> 'redeem' OR "delta" < 0)
  );

-- The points ledger is append-only, like the journal: a mistake is corrected with an adjustment.
CREATE OR REPLACE FUNCTION loyalty_transactions_guard() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Loyalty transactions are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "loyalty_transactions_guard"
  BEFORE UPDATE OR DELETE ON "loyalty_transactions"
  FOR EACH ROW EXECUTE FUNCTION loyalty_transactions_guard();

-- A guest can't spend points they don't have. The app checks under the same lock;
-- this is the backstop for any write that doesn't go through it.
CREATE OR REPLACE FUNCTION loyalty_transactions_no_overdraft() RETURNS trigger AS $$
DECLARE
  balance BIGINT;
BEGIN
  IF NEW."delta" >= 0 THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('loyalty:' || NEW."user_id"));
  SELECT COALESCE(SUM("delta"), 0) INTO balance FROM "loyalty_transactions" WHERE "user_id" = NEW."user_id";
  IF balance + NEW."delta" < 0 THEN
    RAISE EXCEPTION 'Not enough loyalty points (balance %, change %)', balance, NEW."delta";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "loyalty_transactions_no_overdraft"
  BEFORE INSERT ON "loyalty_transactions"
  FOR EACH ROW EXECUTE FUNCTION loyalty_transactions_no_overdraft();

ALTER TABLE "loyalty_settings" ADD CONSTRAINT "loyalty_settings_values_chk"
  CHECK (
    "id" = 1
    AND "toman_per_point" > 0
    AND "point_value" > 0
    AND "min_redeem_points" >= 0
  );

INSERT INTO "loyalty_settings" ("id", "updated_at") VALUES (1, CURRENT_TIMESTAMP);

-- ── Cash shifts ─────────────────────────────────────────────────────────────

ALTER TABLE "cash_shifts" ADD CONSTRAINT "cash_shifts_values_chk"
  CHECK (
    "status" IN ('open', 'closed')
    AND "opening_float" >= 0
    AND (
      ("status" = 'open' AND "closed_at" IS NULL AND "counted_cash" IS NULL AND "expected_cash" IS NULL AND "difference" IS NULL)
      OR ("status" = 'closed' AND "closed_at" IS NOT NULL AND "counted_cash" >= 0 AND "expected_cash" IS NOT NULL
          AND "difference" = "counted_cash" - "expected_cash")
    )
  );

-- One drawer, one open shift.
CREATE UNIQUE INDEX "cash_shifts_one_open" ON "cash_shifts"("status") WHERE "status" = 'open';

-- Shortages and overages found when a shift's drawer is counted.
INSERT INTO "ledger_accounts" ("code", "name", "name_fa", "type", "is_system") VALUES
  ('6800', 'Cash over and short', 'کسری و اضافی صندوق', 'expense', true)
ON CONFLICT ("code") DO UPDATE SET "is_system" = true;
