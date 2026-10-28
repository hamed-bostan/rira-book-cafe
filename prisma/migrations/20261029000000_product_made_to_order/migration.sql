-- Items made when ordered (drinks, breakfast) aren't counted: ordering neither
-- checks nor takes their stock, and cancelling doesn't put any back. Every
-- existing item stays counted until staff switch it over.
ALTER TABLE "products" ADD COLUMN "made_to_order" BOOLEAN NOT NULL DEFAULT false;
