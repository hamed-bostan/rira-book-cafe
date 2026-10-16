-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "avatar_url" TEXT,
    "role" TEXT NOT NULL DEFAULT 'customer',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon_url" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_translations" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'drink',
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "original_price" INTEGER,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "image_url" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "badge" TEXT,
    "unit" TEXT,
    "description" TEXT,
    "nutrition" TEXT,
    "origin" TEXT,
    "dietary" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tax_exempt" BOOLEAN NOT NULL DEFAULT true,
    "book_author" TEXT,
    "book_isbn" TEXT,
    "book_availability" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_translations" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "description" TEXT,
    "nutrition" TEXT,
    "origin" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_log" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_name" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "entity_label" TEXT,
    "changes" JSONB NOT NULL,
    "changed_fields" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "order_number" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "service_type" TEXT NOT NULL,
    "table_label" TEXT,
    "note" TEXT,
    "payment_status" TEXT NOT NULL DEFAULT 'unpaid',
    "subtotal" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "placed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT,
    "position" INTEGER NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_events" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_notes" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "author_name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "reference" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "guest_name" TEXT NOT NULL,
    "guest_phone" TEXT NOT NULL,
    "party_size" INTEGER NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "table_label" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "title_fa" TEXT,
    "description_fa" TEXT,
    "image_url" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER,
    "price" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_registrations" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "guest_name" TEXT NOT NULL,
    "guest_phone" TEXT NOT NULL,
    "seats" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'registered',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_is_active_idx" ON "categories"("is_active");

-- CreateIndex
CREATE INDEX "category_translations_category_id_idx" ON "category_translations"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "category_translations_category_id_locale_key" ON "category_translations"("category_id", "locale");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "products_is_published_idx" ON "products"("is_published");

-- CreateIndex
CREATE INDEX "products_kind_idx" ON "products"("kind");

-- CreateIndex
CREATE INDEX "product_translations_product_id_idx" ON "product_translations"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_translations_product_id_locale_key" ON "product_translations"("product_id", "locale");

-- CreateIndex
CREATE INDEX "activity_log_created_at_idx" ON "activity_log"("created_at");

-- CreateIndex
CREATE INDEX "activity_log_entity_type_entity_id_created_at_idx" ON "activity_log"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "activity_log_actor_id_created_at_idx" ON "activity_log"("actor_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_status_placed_at_idx" ON "orders"("status", "placed_at");

-- CreateIndex
CREATE INDEX "orders_user_id_placed_at_idx" ON "orders"("user_id", "placed_at");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_status_events_order_id_created_at_idx" ON "order_status_events"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "order_notes_order_id_created_at_idx" ON "order_notes"("order_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_reference_key" ON "reservations"("reference");

-- CreateIndex
CREATE INDEX "reservations_starts_at_idx" ON "reservations"("starts_at");

-- CreateIndex
CREATE INDEX "reservations_table_label_starts_at_idx" ON "reservations"("table_label", "starts_at");

-- CreateIndex
CREATE INDEX "reservations_user_id_starts_at_idx" ON "reservations"("user_id", "starts_at");

-- CreateIndex
CREATE INDEX "events_is_published_starts_at_idx" ON "events"("is_published", "starts_at");

-- CreateIndex
CREATE INDEX "event_registrations_event_id_status_idx" ON "event_registrations"("event_id", "status");

-- CreateIndex
CREATE INDEX "event_registrations_user_id_created_at_idx" ON "event_registrations"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

