-- Remove the optional authenticator-app two-factor sign-in: phone OTP is the only
-- sign-in factor. Drops the enrolment table, the per-session "passed the second
-- factor" timestamp and the owner's "require two-factor" team setting.

-- DropTable
DROP TABLE "user_two_factor";

-- AlterTable
ALTER TABLE "user_sessions" DROP COLUMN "two_factor_verified_at";

-- AlterTable
ALTER TABLE "team_settings" DROP COLUMN "require_two_factor";
