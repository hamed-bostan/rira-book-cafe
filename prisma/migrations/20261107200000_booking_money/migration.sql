-- Money on bookings: a deposit held against a table, the suite's nightly price, and
-- refunds of what was paid for a suite stay or an event sign-up.

-- ── Table deposits ─────────────────────────────────────────────────────────────
-- Like a book loan's deposit: the cafe's to hold (Deposits held) until it's handed
-- back or kept.
ALTER TABLE "reservations"
  ADD COLUMN "deposit_amount" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "deposit_method" TEXT,
  ADD COLUMN "deposit_state" TEXT;

ALTER TABLE "reservations" ADD CONSTRAINT "reservations_deposit_chk"
  CHECK (
    "deposit_amount" >= 0
    AND ("deposit_amount" = 0) = ("deposit_method" IS NULL)
    AND ("deposit_amount" = 0) = ("deposit_state" IS NULL)
    AND ("deposit_method" IS NULL OR "deposit_method" IN ('cash', 'card', 'transfer'))
    AND ("deposit_state" IS NULL OR "deposit_state" IN ('held', 'returned', 'kept'))
  );

-- ── The suite's price ──────────────────────────────────────────────────────────
-- One row: what a night costs. Each stay snapshots it; a stay's total is always
-- its nights times its own rate, never stored. Stays from before have no rate.
CREATE TABLE "suite_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "nightly_rate" BIGINT NOT NULL DEFAULT 2500000,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suite_settings_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "suite_settings" ADD CONSTRAINT "suite_settings_values_chk"
  CHECK ("id" = 1 AND "nightly_rate" >= 0);

INSERT INTO "suite_settings" ("id", "nightly_rate", "updated_at") VALUES (1, 2500000, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "suite_bookings" ADD COLUMN "nightly_rate" BIGINT;

ALTER TABLE "suite_bookings" ADD CONSTRAINT "suite_bookings_nightly_rate_chk"
  CHECK ("nightly_rate" IS NULL OR "nightly_rate" >= 0);

-- ── Refunds ────────────────────────────────────────────────────────────────────
-- Money handed back from one payment (an income row), in part or in full.
CREATE TABLE "income_refunds" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "income_id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" BIGINT NOT NULL,
    "vat_amount" BIGINT NOT NULL DEFAULT 0,
    "method" TEXT NOT NULL,
    "reason" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "income_refunds_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "income_refunds_number_key" ON "income_refunds"("number");
CREATE INDEX "income_refunds_income_id_idx" ON "income_refunds"("income_id");
CREATE INDEX "income_refunds_source_type_source_id_idx" ON "income_refunds"("source_type", "source_id");

ALTER TABLE "income_refunds" ADD CONSTRAINT "income_refunds_income_id_fkey" FOREIGN KEY ("income_id") REFERENCES "incomes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "income_refunds" ADD CONSTRAINT "income_refunds_values_chk"
  CHECK (
    "amount" > 0
    AND "vat_amount" >= 0
    AND "vat_amount" <= "amount"
    AND "method" IN ('cash', 'card', 'transfer')
    AND "source_type" IN ('eventRegistration', 'suiteBooking')
  );

-- A payment can't hand back more than it took. The app checks this with the payment
-- row locked; this is the backstop for any write that doesn't go through it.
CREATE OR REPLACE FUNCTION income_refunds_within_payment() RETURNS trigger AS $$
DECLARE
  paid BIGINT;
  refunded BIGINT;
BEGIN
  SELECT "amount" INTO paid FROM "incomes" WHERE "id" = NEW."income_id" FOR UPDATE;
  SELECT COALESCE(SUM("amount"), 0) INTO refunded FROM "income_refunds" WHERE "income_id" = NEW."income_id";
  IF refunded + NEW."amount" > paid THEN
    RAISE EXCEPTION 'A refund can''t exceed what was paid (IN %)', NEW."income_id";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "income_refunds_within_payment"
  BEFORE INSERT ON "income_refunds"
  FOR EACH ROW EXECUTE FUNCTION income_refunds_within_payment();

-- Refund rows are history, like the journal they're posted to.
CREATE OR REPLACE FUNCTION income_refunds_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Refunds can''t be changed or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "income_refunds_no_update_delete"
  BEFORE UPDATE OR DELETE ON "income_refunds"
  FOR EACH ROW EXECUTE FUNCTION income_refunds_immutable();
