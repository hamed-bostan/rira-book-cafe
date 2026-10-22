-- Where a category sits on the menu, first = 0. Guests see categories in this
-- order and staff move them up and down from the dashboard. Existing categories
-- keep the order they were shown in until now: oldest first.
ALTER TABLE "categories" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

UPDATE "categories" AS c
SET "position" = ranked.rn - 1
FROM (SELECT "id", ROW_NUMBER() OVER (ORDER BY "created_at", "id") AS rn FROM "categories") AS ranked
WHERE c."id" = ranked."id";

CREATE INDEX "categories_position_idx" ON "categories"("position");
