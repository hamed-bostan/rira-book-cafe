-- Staff can change an order after it's placed: add a round, lower or remove a line,
-- move the table or change how it's served.
--
-- `orders.changed_at` is when that last happened (the bar display marks the ticket);
-- `order_items.added_at` is when a line came in after the order was placed (a second
-- round), null for the lines it was placed with. The status timeline records each
-- change as a row of kind `changed`, beside the status moves it already holds.
ALTER TABLE "orders" ADD COLUMN "changed_at" TIMESTAMP(3);
ALTER TABLE "order_items" ADD COLUMN "added_at" TIMESTAMP(3);

ALTER TABLE "order_status_events" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'status';
ALTER TABLE "order_status_events" ADD CONSTRAINT "order_status_events_kind_valid"
  CHECK ("kind" IN ('status', 'changed'));
