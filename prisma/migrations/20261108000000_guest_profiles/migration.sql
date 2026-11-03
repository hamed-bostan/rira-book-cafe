-- Every booking, stay, loan, hold and order belongs to a guest profile: a user
-- whose id is the guest's normalized phone. Staff make one from the phone a guest
-- gives them when there's none yet, so a profile can now exist before its guest
-- ever signs in. These columns say who made it, and whether the guest has since
-- signed in with that phone.
ALTER TABLE "users"
  ADD COLUMN "created_by_id" TEXT,
  ADD COLUMN "first_signed_in_at" TIMESTAMP(3);

-- Everyone already here got their row by signing in (or by being given dashboard
-- access ahead of it): they count as signed in from when the row was made. Runs
-- before the backfill that follows, whose profiles haven't been signed in to.
UPDATE "users" SET "first_signed_in_at" = "created_at" WHERE "first_signed_in_at" IS NULL;
