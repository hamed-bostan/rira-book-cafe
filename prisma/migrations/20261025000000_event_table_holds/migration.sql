-- Events can hold floor tables while they run, so guest bookings can't take them.
ALTER TABLE "events" ADD COLUMN "table_labels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- The clash checks look up events holding a given table.
CREATE INDEX "events_table_labels_idx" ON "events" USING GIN ("table_labels");
