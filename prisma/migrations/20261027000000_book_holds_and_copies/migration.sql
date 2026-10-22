-- How many copies of a book the shelf lends; null reads as one. Lending refuses a
-- book once every copy is out.
ALTER TABLE "products" ADD COLUMN "book_copies" INTEGER;
ALTER TABLE "products" ADD CONSTRAINT "products_book_copies_chk" CHECK ("book_copies" IS NULL OR "book_copies" >= 1);

-- Staff add guests to a book's line who asked at the counter or by phone: those
-- holds have no guest account behind them.
ALTER TABLE "book_waitlist" ALTER COLUMN "user_id" DROP NOT NULL;

-- One open hold per phone per book — what keeps a counter hold from duplicating a
-- guest's own (the per-account index can't, its user_id is null).
CREATE UNIQUE INDEX "book_waitlist_one_open_per_phone" ON "book_waitlist"("product_id", "guest_phone")
  WHERE "status" IN ('waiting', 'notified');
