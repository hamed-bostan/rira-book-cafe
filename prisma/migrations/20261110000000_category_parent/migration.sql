-- A category may sit under another (one level: parents and their subcategories).
-- Existing categories stay top-level, keeping their places: `position` now counts
-- among siblings, and every category is a sibling of the others at the top level.
ALTER TABLE "categories" ADD COLUMN "parent_id" TEXT;

-- A parent can't be deleted while it still has subcategories (the use-case
-- refuses first, naming how many).
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- No category is its own parent. Deeper nesting is refused by the use-cases.
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_not_self" CHECK ("parent_id" IS NULL OR "parent_id" <> "id");

CREATE INDEX "categories_parent_id_position_idx" ON "categories"("parent_id", "position");
