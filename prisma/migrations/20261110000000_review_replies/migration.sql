-- The cafe's one public reply to a review, written by staff with `reviews.moderate`.
ALTER TABLE "product_reviews" ADD COLUMN "reply_text" TEXT;
ALTER TABLE "product_reviews" ADD COLUMN "reply_by_id" TEXT;
ALTER TABLE "product_reviews" ADD COLUMN "reply_by_name" TEXT;
ALTER TABLE "product_reviews" ADD COLUMN "replied_at" TIMESTAMP(3);
ALTER TABLE "product_reviews" ADD COLUMN "reply_updated_at" TIMESTAMP(3);

-- The moderation queue filtered by stars.
CREATE INDEX "product_reviews_status_rating_created_at_idx" ON "product_reviews"("status", "rating", "created_at");
