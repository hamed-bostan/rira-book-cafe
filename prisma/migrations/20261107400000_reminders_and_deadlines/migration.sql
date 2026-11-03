-- A request nobody answered in time is cancelled by the background jobs, and so
-- is a held book nobody came for. They stay `cancelled` — every rule that reads
-- that status (day counts, covers, the floor, reports) stays right — and
-- `expired_at` says it was the clock, not a person, and when. Only a cancelled
-- row can carry it.
ALTER TABLE "reservations" ADD COLUMN "expired_at" TIMESTAMP(3);
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_expired_chk"
  CHECK ("expired_at" IS NULL OR "status" = 'cancelled');

ALTER TABLE "suite_bookings" ADD COLUMN "expired_at" TIMESTAMP(3);
ALTER TABLE "suite_bookings" ADD CONSTRAINT "suite_bookings_expired_chk"
  CHECK ("expired_at" IS NULL OR "status" = 'cancelled');

-- A guest told their book is back has until the end of a cafe day to collect it
-- (`HOLD_PICKUP_DAYS` after the day they were told). Stamped when they're told, so
-- the day they were promised stays put if the rule changes later.
ALTER TABLE "book_waitlist" ADD COLUMN "pickup_by" TIMESTAMP(3), ADD COLUMN "expired_at" TIMESTAMP(3);
ALTER TABLE "book_waitlist" ADD CONSTRAINT "book_waitlist_expired_chk"
  CHECK ("expired_at" IS NULL OR "status" = 'cancelled');

-- Guests told before this: the last instant of the third cafe day (Tehran) after
-- the day they were told — what `holdPickupDeadline` works out.
UPDATE "book_waitlist"
SET "pickup_by" = (
    (date_trunc('day', ("notified_at" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Tehran') + INTERVAL '4 days')
      AT TIME ZONE 'Asia/Tehran' AT TIME ZONE 'UTC'
  ) - INTERVAL '1 millisecond'
WHERE "notified_at" IS NOT NULL;

-- Whoever is told says by when.
ALTER TABLE "book_waitlist" ADD CONSTRAINT "book_waitlist_pickup_by_chk"
  CHECK ("status" <> 'notified' OR "pickup_by" IS NOT NULL);

-- The jobs look up told holds by their deadline.
CREATE INDEX "book_waitlist_status_pickup_by_idx" ON "book_waitlist"("status", "pickup_by");
