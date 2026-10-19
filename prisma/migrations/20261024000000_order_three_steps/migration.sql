-- Orders now go placed (pending) → preparing → served (completed): the `accepted`
-- and `ready` steps are gone. Open orders in either move to `preparing`; their
-- history is mapped the same way, and the steps that became no-ops
-- (preparing → preparing) are dropped so the timeline still reads one change per row.
UPDATE "orders" SET "status" = 'preparing' WHERE "status" IN ('accepted', 'ready');

UPDATE "order_status_events" SET "from_status" = 'preparing' WHERE "from_status" IN ('accepted', 'ready');
UPDATE "order_status_events" SET "to_status" = 'preparing' WHERE "to_status" IN ('accepted', 'ready');
DELETE FROM "order_status_events" WHERE "from_status" = "to_status";
