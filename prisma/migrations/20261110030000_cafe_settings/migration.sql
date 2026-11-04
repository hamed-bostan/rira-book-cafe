-- The cafe's own settings: its profile, opening hours and receipt copy (one row),
-- and the floor's tables, which until now were a constant in the code
-- (`CAFE_TABLES`). The tables are copied in as they were, so bookings, event
-- holds and the pickers behave exactly as before on day one.

-- ── Settings ────────────────────────────────────────────────────────────────────

CREATE TABLE "cafe_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT,
    "name_fa" TEXT,
    "address" TEXT,
    "address_fa" TEXT,
    "phone" TEXT,
    "instagram" TEXT,
    "website" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "weekly_hours" JSONB,
    "hours_exceptions" JSONB NOT NULL DEFAULT '[]',
    "receipt_header" TEXT,
    "receipt_header_fa" TEXT,
    "receipt_footer" TEXT,
    "receipt_footer_fa" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cafe_settings_pkey" PRIMARY KEY ("id")
);

-- One row, and coordinates that are somewhere on Earth (both or neither).
ALTER TABLE "cafe_settings" ADD CONSTRAINT "cafe_settings_values_chk"
  CHECK (
    "id" = 1
    AND ("latitude" IS NULL) = ("longitude" IS NULL)
    AND ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90)
    AND ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180)
    AND jsonb_typeof("hours_exceptions") = 'array'
  );

INSERT INTO "cafe_settings" ("id", "updated_at") VALUES (1, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- ── Tables ──────────────────────────────────────────────────────────────────────

CREATE TABLE "cafe_tables" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "seats" INTEGER NOT NULL,
    "area" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cafe_tables_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cafe_tables_label_key" ON "cafe_tables"("label");
CREATE INDEX "cafe_tables_position_idx" ON "cafe_tables"("position");

-- The same caps the app enforces: a label that fits an order's table field, a
-- table that seats someone.
ALTER TABLE "cafe_tables" ADD CONSTRAINT "cafe_tables_values_chk"
  CHECK (
    char_length("label") BETWEEN 1 AND 20
    AND "seats" BETWEEN 1 AND 40
    AND ("area" IS NULL OR char_length("area") <= 40)
    AND "position" >= 0
  );

-- The floor plan as the code had it, in floor order.
INSERT INTO "cafe_tables" ("id", "label", "seats", "position", "updated_at")
SELECT gen_random_uuid()::text, t.label, t.seats, t.position, CURRENT_TIMESTAMP
FROM (VALUES
  ('1', 2, 0),
  ('2', 2, 1),
  ('3', 4, 2),
  ('4', 4, 3),
  ('5', 4, 4),
  ('6', 6, 5),
  ('7', 6, 6),
  ('8', 8, 7),
  ('long', 12, 8)
) AS t(label, seats, position)
ON CONFLICT ("label") DO NOTHING;
