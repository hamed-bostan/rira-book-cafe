-- Attach every booking, stay, loan, hold and order made for a guest by phone to
-- that guest's profile, making the profile where there's none yet — so a guest
-- who signs in with the number finds them all, and staff never see a record that
-- is only a name and a phone again.
--
-- The phone is reduced exactly as `normalizePhone` (src/domain/entities/Phone.ts)
-- reduces it, because a user's id *is* that: Persian (۰–۹) and Arabic-Indic (٠–٩)
-- digits count as the digits they are, everything but ASCII digits is dropped,
-- and 12 digits starting 98 (Iran's +98) become the local 0…. A record is
-- attached only when that leaves at least 8 digits (`isPlausiblePhone`); one
-- without a usable phone keeps no profile. The integration test runs this file
-- over typed numbers and holds it to `normalizePhone`.
--
-- Safe to run again: it reads only rows still without a user_id, and makes a
-- profile only where none exists. A single DO block, so it's one statement.
DO $$
DECLARE
  hold RECORD;
BEGIN
  CREATE TEMP TABLE "guest_backfill" (
    "kind" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "rank" INTEGER NOT NULL,
    "at" TIMESTAMP(3) NOT NULL
  );

  INSERT INTO "guest_backfill"
  SELECT r."kind", r."record_id", n."user_id", btrim(r."phone"), NULLIF(btrim(r."name"), ''), r."rank", r."at"
  FROM (
    SELECT 'reservation', "id", "guest_phone", "guest_name", 1, "created_at" FROM "reservations" WHERE "user_id" IS NULL
    UNION ALL
    SELECT 'suite', "id", "guest_phone", "guest_name", 1, "created_at" FROM "suite_bookings" WHERE "user_id" IS NULL
    UNION ALL
    SELECT 'loan', "id", "borrower_phone", "borrower_name", 1, "created_at" FROM "book_loans" WHERE "user_id" IS NULL
    UNION ALL
    SELECT 'hold', "id", "guest_phone", "guest_name", 1, "created_at" FROM "book_waitlist" WHERE "user_id" IS NULL
    UNION ALL
    -- A counter sale was named "Walk-in guest" unless staff typed a name: that's no name for a profile.
    SELECT 'order', "id", "customer_phone",
      CASE WHEN btrim("customer_name") IN ('Walk-in guest', 'مهمان حضوری') THEN NULL ELSE "customer_name" END,
      2, "placed_at"
    FROM "orders" WHERE "user_id" IS NULL
  ) AS r("kind", "record_id", "phone", "name", "rank", "at")
  CROSS JOIN LATERAL (
    SELECT regexp_replace(
      translate(r."phone", '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', '01234567890123456789'),
      '[^0-9]', '', 'g'
    ) AS "digits"
  ) AS d
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN d."digits" LIKE '98%' AND length(d."digits") = 12 THEN '0' || substr(d."digits", 3)
      ELSE d."digits"
    END AS "user_id"
  ) AS n
  WHERE length(n."user_id") >= 8;

  -- One profile for each phone that has none, named from its records: a booking,
  -- stay, loan or hold before a sale (staff typed those names), the latest first;
  -- the sign-in placeholder when none of them has a name.
  INSERT INTO "users" ("id", "phone", "name", "role", "updated_at")
  SELECT DISTINCT ON (b."user_id") b."user_id", b."phone", COALESCE(b."name", 'Rira Guest'), 'customer', CURRENT_TIMESTAMP
  FROM "guest_backfill" b
  ORDER BY b."user_id", b."name" IS NULL, b."rank", b."at" DESC
  ON CONFLICT ("id") DO NOTHING;

  UPDATE "reservations" AS t SET "user_id" = b."user_id"
  FROM "guest_backfill" b WHERE b."kind" = 'reservation' AND t."id" = b."record_id";

  UPDATE "suite_bookings" AS t SET "user_id" = b."user_id"
  FROM "guest_backfill" b WHERE b."kind" = 'suite' AND t."id" = b."record_id";

  UPDATE "book_loans" AS t SET "user_id" = b."user_id"
  FROM "guest_backfill" b WHERE b."kind" = 'loan' AND t."id" = b."record_id";

  UPDATE "orders" AS t SET "user_id" = b."user_id"
  FROM "guest_backfill" b WHERE b."kind" = 'order' AND t."id" = b."record_id";

  -- A guest is in a book's line at most once at a time (`book_waitlist_one_open_per_guest`).
  -- A phone-only hold that would be the guest's second open one on the same book
  -- keeps no profile rather than failing the deploy; it stays readable by its phone.
  FOR hold IN SELECT b."record_id", b."user_id" FROM "guest_backfill" b WHERE b."kind" = 'hold' ORDER BY b."at" LOOP
    BEGIN
      UPDATE "book_waitlist" SET "user_id" = hold."user_id" WHERE "id" = hold."record_id";
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END LOOP;

  DROP TABLE "guest_backfill";
END $$;
