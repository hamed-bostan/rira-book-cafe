-- Deleting a promo code that orders used now archives it instead: the row stays, so
-- those orders still resolve it by id (and keep their discount when staff change
-- them), and its code stays taken, so re-creating it can't reset per-guest limits.
-- A code no order ever carried is still deleted outright.

-- AlterTable
ALTER TABLE "promo_codes" ADD COLUMN "archived_at" TIMESTAMP(3);
