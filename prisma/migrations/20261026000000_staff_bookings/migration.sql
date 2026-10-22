-- Staff can book a table or the suite for a guest who rang or walked in: those
-- bookings have no guest account behind them.
ALTER TABLE "reservations" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "suite_bookings" ALTER COLUMN "user_id" DROP NOT NULL;
