-- CreateTable
CREATE TABLE "suite_bookings" (
    "id" TEXT NOT NULL,
    "reference" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "guest_name" TEXT NOT NULL,
    "guest_phone" TEXT NOT NULL,
    "guests" INTEGER NOT NULL,
    "check_in" DATE NOT NULL,
    "check_out" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suite_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_loans" (
    "id" TEXT NOT NULL,
    "reference" SERIAL NOT NULL,
    "product_id" TEXT NOT NULL,
    "book_title" TEXT NOT NULL,
    "book_author" TEXT,
    "user_id" TEXT,
    "borrower_name" TEXT NOT NULL,
    "borrower_phone" TEXT NOT NULL,
    "lent_at" TIMESTAMP(3) NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'out',
    "returned_at" TIMESTAMP(3),
    "note" TEXT,
    "lent_by_id" TEXT NOT NULL,
    "lent_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "book_loans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "suite_bookings_reference_key" ON "suite_bookings"("reference");

-- CreateIndex
CREATE INDEX "suite_bookings_check_out_check_in_idx" ON "suite_bookings"("check_out", "check_in");

-- CreateIndex
CREATE INDEX "suite_bookings_user_id_check_in_idx" ON "suite_bookings"("user_id", "check_in");

-- CreateIndex
CREATE UNIQUE INDEX "book_loans_reference_key" ON "book_loans"("reference");

-- CreateIndex
CREATE INDEX "book_loans_status_due_at_idx" ON "book_loans"("status", "due_at");

-- CreateIndex
CREATE INDEX "book_loans_product_id_status_idx" ON "book_loans"("product_id", "status");

-- CreateIndex
CREATE INDEX "book_loans_borrower_phone_idx" ON "book_loans"("borrower_phone");

-- CreateIndex
CREATE INDEX "book_loans_user_id_lent_at_idx" ON "book_loans"("user_id", "lent_at");


-- ── Suite ───────────────────────────────────────────────────────────────────

ALTER TABLE "suite_bookings" ADD CONSTRAINT "suite_bookings_values_chk"
  CHECK (
    "status" IN ('requested', 'confirmed', 'checkedIn', 'checkedOut', 'cancelled', 'noShow')
    AND "check_out" > "check_in"
    AND "guests" > 0
  );

-- The suite is one room: two stays holding it (confirmed, checked in) can never
-- share a night. The app checks this under the same lock; this is the backstop
-- for any write that doesn't go through it. The lock serializes concurrent writers
-- so the check can't race.
CREATE OR REPLACE FUNCTION suite_bookings_no_overlap() RETURNS trigger AS $$
DECLARE
  clash INTEGER;
BEGIN
  IF NEW."status" NOT IN ('confirmed', 'checkedIn') THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('suite'));
  SELECT "reference" INTO clash FROM "suite_bookings"
    WHERE "id" <> NEW."id"
      AND "status" IN ('confirmed', 'checkedIn')
      AND "check_in" < NEW."check_out"
      AND NEW."check_in" < "check_out"
    LIMIT 1;
  IF clash IS NOT NULL THEN
    RAISE EXCEPTION 'The suite is already booked for those nights (S-%)', clash;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "suite_bookings_no_overlap"
  BEFORE INSERT OR UPDATE ON "suite_bookings"
  FOR EACH ROW EXECUTE FUNCTION suite_bookings_no_overlap();

-- ── Book loans ──────────────────────────────────────────────────────────────

ALTER TABLE "book_loans" ADD CONSTRAINT "book_loans_values_chk"
  CHECK (
    "status" IN ('out', 'returned', 'lost')
    AND "due_at" > "lent_at"
    -- A returned book says when; nothing else does.
    AND (("status" = 'returned') = ("returned_at" IS NOT NULL))
  );

-- One borrower can't hold two open loans of the same book.
CREATE OR REPLACE FUNCTION book_loans_no_duplicate() RETURNS trigger AS $$
BEGIN
  IF NEW."status" <> 'out' THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('book-loan:' || NEW."product_id"));
  IF EXISTS (
    SELECT 1 FROM "book_loans"
      WHERE "id" <> NEW."id"
        AND "status" = 'out'
        AND "product_id" = NEW."product_id"
        AND "borrower_phone" = NEW."borrower_phone"
  ) THEN
    RAISE EXCEPTION 'This borrower already has this book on loan';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "book_loans_no_duplicate"
  BEFORE INSERT OR UPDATE ON "book_loans"
  FOR EACH ROW EXECUTE FUNCTION book_loans_no_duplicate();
