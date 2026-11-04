-- One count for a tracked book's copies. A book whose recipe is a single stock item
-- (the one-copy recipe "Track books" makes) used to keep two counts that drifted:
-- deliveries, counts, waste, opening stock and voided deliveries moved only the
-- stock item, while the item's edit form moved only the sale stock. From now on
-- every stock movement moves both (writeStock.ts), so they are brought together
-- once here.
--
-- The stock item is the truth — it's what was counted, received and booked. The
-- sale stock is set to its copies on hand less the copies open orders (pending or
-- preparing) hold: an order takes its copies off the sale stock when it's placed,
-- and out of the stock item only when it's completed. That is exactly the
-- relation the running code keeps. Lending copies (`book_copies`) are a separate
-- count and aren't touched.
--
-- Data only, and safe to run again: it sets each book from current rows, so a
-- second run changes nothing.
UPDATE "products" AS p
SET "stock_quantity" = (ROUND(i."on_hand" / rl."quantity"))::INTEGER - COALESCE(open_orders."reserved", 0),
    "updated_at" = NOW()
FROM "recipe_lines" AS rl
JOIN "ingredients" AS i ON i."id" = rl."ingredient_id"
LEFT JOIN (
  SELECT oi."product_id", SUM(oi."quantity")::INTEGER AS "reserved"
  FROM "order_items" AS oi
  JOIN "orders" AS o ON o."id" = oi."order_id"
  WHERE o."status" IN ('pending', 'preparing')
  GROUP BY oi."product_id"
) AS open_orders ON open_orders."product_id" = rl."product_id"
WHERE rl."product_id" = p."id"
  AND p."kind" = 'book'
  AND p."made_to_order" = FALSE
  AND rl."quantity" > 0
  AND NOT EXISTS (
    SELECT 1 FROM "recipe_lines" AS other
    WHERE other."product_id" = rl."product_id" AND other."ingredient_id" <> rl."ingredient_id"
  )
  AND p."stock_quantity" IS DISTINCT FROM
    (ROUND(i."on_hand" / rl."quantity"))::INTEGER - COALESCE(open_orders."reserved", 0);
