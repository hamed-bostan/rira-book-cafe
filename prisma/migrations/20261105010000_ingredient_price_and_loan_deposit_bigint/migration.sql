-- An ingredient's purchase price and a book loan's deposit become BIGINT, like the
-- books they're posted to. Their forms take finance amounts (up to MAX_MONEY_AMOUNT),
-- and a delivery line's cost becomes the ingredient's price, so as INTEGER anything
-- over ~2.1 billion Toman failed to save. Widening int4 → int8 keeps every value.
-- AlterTable
ALTER TABLE "book_loans" ALTER COLUMN "deposit_amount" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "ingredients" ALTER COLUMN "purchase_price" SET DATA TYPE BIGINT;
