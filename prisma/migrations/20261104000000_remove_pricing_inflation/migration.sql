-- The pricing advisor no longer allows for inflation: suggested prices cover today's
-- cost. Drops the monthly rate and price horizon added by 20261023000000_pricing_inflation.
-- AlterTable
ALTER TABLE "pricing_settings" DROP COLUMN "monthly_inflation_bps",
DROP COLUMN "price_horizon_months";
