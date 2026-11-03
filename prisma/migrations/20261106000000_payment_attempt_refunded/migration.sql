-- An online payment the gateway captured but no order could take (`unapplied`) is
-- given back to the guest from the gateway's panel; staff then mark it `refunded`.
-- Nothing is booked either way: an unapplied payment never reached the books. The
-- database's list of statuses, and its rule that a captured payment carries the
-- gateway's reference, take the new status in.
ALTER TABLE "payment_attempts"
  DROP CONSTRAINT "payment_attempts_status_valid",
  ADD CONSTRAINT "payment_attempts_status_valid"
    CHECK ("status" IN ('pending', 'verifying', 'paid', 'failed', 'unapplied', 'refunded')),
  DROP CONSTRAINT "payment_attempts_captured_ref",
  ADD CONSTRAINT "payment_attempts_captured_ref"
    CHECK ("status" NOT IN ('paid', 'unapplied', 'refunded') OR "ref_id" IS NOT NULL);
