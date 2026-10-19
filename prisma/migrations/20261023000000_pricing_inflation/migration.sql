-- Inflation allowance for the pricing advisor: the expected monthly rise in costs
-- and how long a menu price stays up. 0% leaves suggestions as they were.
-- AlterTable
ALTER TABLE "pricing_settings" ADD COLUMN     "monthly_inflation_bps" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "price_horizon_months" INTEGER NOT NULL DEFAULT 3;
