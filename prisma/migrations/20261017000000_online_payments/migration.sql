-- Online payments (Zarinpal): one row per attempt to pay an order through the gateway.
-- CreateTable
CREATE TABLE "payment_attempts" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "authority" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "live_order_id" TEXT,
    "failure_reason" TEXT,
    "gateway_code" TEXT,
    "ref_id" TEXT,
    "card_pan" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_authority_key" ON "payment_attempts"("authority");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_live_order_id_key" ON "payment_attempts"("live_order_id");

-- CreateIndex
CREATE INDEX "payment_attempts_order_id_created_at_idx" ON "payment_attempts"("order_id", "created_at");

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Rules the app relies on, enforced by the database too.
ALTER TABLE "payment_attempts"
  ADD CONSTRAINT "payment_attempts_amount_positive" CHECK ("amount" > 0),
  ADD CONSTRAINT "payment_attempts_status_valid" CHECK ("status" IN ('pending', 'verifying', 'paid', 'failed', 'unapplied')),
  -- Live (pending/verifying) exactly when it holds the order's live slot.
  ADD CONSTRAINT "payment_attempts_live_slot" CHECK (
    ("status" IN ('pending', 'verifying') AND "live_order_id" = "order_id")
    OR ("status" NOT IN ('pending', 'verifying') AND "live_order_id" IS NULL)
  ),
  -- Paid or unapplied means the gateway captured the money and gave its reference.
  ADD CONSTRAINT "payment_attempts_captured_ref" CHECK ("status" NOT IN ('paid', 'unapplied') OR "ref_id" IS NOT NULL);

-- Gateway payouts post their fee to 6700 automatically, so it can't be deactivated.
UPDATE "ledger_accounts" SET "is_system" = true WHERE "code" = '6700';
