-- Every menu item belongs to a category that exists. Until now `category_id` was a
-- plain column: the use-cases only checked it wasn't blank, so an item could point
-- at a category that never existed (or one deleted in a race with a move) and drop
-- silently off the public menu.

-- First, give any such item somewhere to be. They're gathered into one hidden
-- category — off the public menu, as they already were — so staff find them in the
-- dashboard and move them, instead of the key refusing to go on. Nothing is made
-- when there's nothing to recover. Its icon is borrowed from the first category on
-- the menu (or a shipped one when there are none); staff can change it.
INSERT INTO "categories" ("id", "name", "slug", "icon_url", "is_active", "position", "created_at", "updated_at")
SELECT
  'recovered-items',
  'Recovered items',
  'recovered-items',
  COALESCE(
    (SELECT "icon_url" FROM "categories" ORDER BY "position", "created_at" LIMIT 1),
    '/images/seed/icon-books.svg'
  ),
  false,
  COALESCE((SELECT MAX("position") + 1 FROM "categories"), 0),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE EXISTS (
  SELECT 1 FROM "products" p WHERE NOT EXISTS (SELECT 1 FROM "categories" c WHERE c."id" = p."category_id")
)
ON CONFLICT DO NOTHING;

UPDATE "products" p
SET "category_id" = (SELECT "id" FROM "categories" WHERE "slug" = 'recovered-items')
WHERE NOT EXISTS (SELECT 1 FROM "categories" c WHERE c."id" = p."category_id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
