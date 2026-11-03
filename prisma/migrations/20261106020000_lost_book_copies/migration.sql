-- A copy written off as lost comes off the lending shelf, so a book whose only
-- copy is lost has none to lend: copies may now be 0 (null still reads as one).
ALTER TABLE "products" DROP CONSTRAINT "products_book_copies_chk";
ALTER TABLE "products" ADD CONSTRAINT "products_book_copies_chk" CHECK ("book_copies" IS NULL OR "book_copies" >= 0);
