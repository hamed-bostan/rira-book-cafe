-- Checkout pricing: a service charge on dine-in orders, promo codes scoped to items,
-- categories or a guest's first order, and loyalty points that lapse after months
-- without activity. Every new setting defaults to off, so nothing changes until the
-- owner turns it on; existing orders carry no service charge.

-- ── Service charge ──────────────────────────────────────────────────────────

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "service_charge" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "service_charge_bps" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "order_refund_lines" ADD COLUMN     "service_charge" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "service_charge_vat" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "accounting_settings" ADD COLUMN     "service_charge_bps" INTEGER NOT NULL DEFAULT 0;

-- What the guest pays now includes the service charge: the lines, less the
-- discounts, plus the charge on what's left.
ALTER TABLE "orders" DROP CONSTRAINT "orders_discounts_chk";
ALTER TABLE "orders" ADD CONSTRAINT "orders_discounts_chk"
  CHECK (
    "promo_discount" >= 0
    AND "points_redeemed" >= 0
    AND "points_discount" >= 0
    AND "points_earned" >= 0
    AND "service_charge" >= 0
    AND "service_charge_bps" BETWEEN 0 AND 2500
    AND "total" = "subtotal" - "promo_discount" - "points_discount" + "service_charge"
    AND "total" >= 0
  );

ALTER TABLE "order_refund_lines" ADD CONSTRAINT "order_refund_lines_service_charge_chk"
  CHECK (
    "service_charge" >= 0
    AND "service_charge_vat" >= 0
    AND "service_charge_vat" <= "service_charge"
    AND "service_charge" <= "amount"
  );

ALTER TABLE "accounting_settings" ADD CONSTRAINT "accounting_settings_service_charge_chk"
  CHECK ("service_charge_bps" BETWEEN 0 AND 2500);

-- Service charge income: a system account, so it can't be switched off from under
-- the sale postings.
INSERT INTO "ledger_accounts" ("code", "name", "name_fa", "type", "is_system") VALUES
  ('4600', 'Service charges', 'درآمد حق سرویس', 'revenue', true)
ON CONFLICT ("code") DO UPDATE SET "is_system" = true, "is_active" = true;

-- ── Promo code scope ────────────────────────────────────────────────────────

-- AlterTable
ALTER TABLE "promo_codes" ADD COLUMN     "category_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "first_order_only" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "product_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- ── Loyalty points expiry ───────────────────────────────────────────────────

-- AlterTable
ALTER TABLE "loyalty_settings" ADD COLUMN     "points_expiry_months" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "points_expiry_since" TIMESTAMP(3);

ALTER TABLE "loyalty_settings" ADD CONSTRAINT "loyalty_settings_expiry_chk"
  CHECK ("points_expiry_months" BETWEEN 0 AND 120);

-- Points that lapsed come off like any other movement, as an `expire` entry.
ALTER TABLE "loyalty_transactions" DROP CONSTRAINT "loyalty_transactions_values_chk";
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_values_chk"
  CHECK (
    "delta" <> 0
    AND "reason" IN ('earn', 'redeem', 'refund', 'adjust', 'expire')
    AND ("reason" NOT IN ('earn', 'refund') OR "delta" > 0)
    AND ("reason" NOT IN ('redeem', 'expire') OR "delta" < 0)
  );
