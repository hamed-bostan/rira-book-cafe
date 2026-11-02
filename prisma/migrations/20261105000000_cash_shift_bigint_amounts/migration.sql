-- Cash-shift amounts become BIGINT, like the journal they're worked out from. As
-- INTEGER, a float over ~2.1 billion Toman (the contract allows 10 billion) failed
-- to save, and a close whose expected cash or difference passed that limit could
-- never be booked. Widening int4 → int8 keeps every existing value.
-- AlterTable
ALTER TABLE "cash_shifts" ALTER COLUMN "opening_float" SET DATA TYPE BIGINT,
ALTER COLUMN "expected_cash" SET DATA TYPE BIGINT,
ALTER COLUMN "counted_cash" SET DATA TYPE BIGINT,
ALTER COLUMN "difference" SET DATA TYPE BIGINT;
