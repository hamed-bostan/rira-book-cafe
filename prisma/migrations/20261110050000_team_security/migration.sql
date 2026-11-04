-- Team security: editable and custom roles, tracked sign-in sessions, optional
-- authenticator-app two-factor, and the owner's team settings (require 2FA,
-- activity-log retention).

-- CreateTable
CREATE TABLE "roles" (
    "key" TEXT NOT NULL,
    "built_in" BOOLEAN NOT NULL DEFAULT false,
    "name_en" TEXT,
    "name_fa" TEXT,
    "permissions" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "two_factor_verified_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_two_factor" (
    "user_id" TEXT NOT NULL,
    "sealed_secret" TEXT NOT NULL,
    "enabled_at" TIMESTAMP(3),
    "last_used_step" INTEGER,
    "recovery_code_hashes" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_two_factor_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "team_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "require_two_factor" BOOLEAN NOT NULL DEFAULT false,
    "activity_retention_months" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "team_settings_single_row" CHECK ("id" = 1),
    CONSTRAINT "team_settings_retention_positive" CHECK ("activity_retention_months" IS NULL OR "activity_retention_months" > 0)
);

-- CreateIndex
CREATE INDEX "user_sessions_user_id_last_seen_at_idx" ON "user_sessions"("user_id", "last_seen_at");

-- CreateIndex
CREATE INDEX "user_sessions_last_seen_at_idx" ON "user_sessions"("last_seen_at");

-- The built-in roles start with exactly the permissions `ROLE_PERMISSIONS` gave
-- them in code, so nothing changes on the day this ships. `owner` and `customer`
-- are never stored: the owner always holds everything, a customer nothing.
INSERT INTO "roles" ("key", "built_in", "permissions", "updated_at") VALUES
  ('support', true, ARRAY['dashboard.view', 'orders.note', 'activity.view'], CURRENT_TIMESTAMP),
  ('staff', true, ARRAY['dashboard.view', 'orders.fulfill', 'orders.note', 'reservations.manage', 'loans.manage', 'activity.view', 'inventory.view', 'shifts.manage'], CURRENT_TIMESTAMP),
  ('admin', true, ARRAY['dashboard.view', 'orders.fulfill', 'orders.note', 'catalog.write', 'reviews.moderate', 'promotions.write', 'reservations.manage', 'loans.manage', 'events.manage', 'reports.view', 'activity.view', 'settings.write', 'accounting.view', 'accounting.write', 'payroll.manage', 'inventory.view', 'inventory.manage', 'shifts.manage'], CURRENT_TIMESTAMP);

INSERT INTO "team_settings" ("id", "updated_at") VALUES (1, CURRENT_TIMESTAMP);
