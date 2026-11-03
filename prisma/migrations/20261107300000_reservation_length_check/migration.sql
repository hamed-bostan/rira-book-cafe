-- A table booking's length is now staff's to choose per booking (60 to 180
-- minutes), not always 90. The table clash check finds an overlapping booking by
-- looking back six hours from the new one's start (`tableHolds.ts`), so a booking
-- may never hold its table longer than that — or one could hide from the check.
-- Held here as well as in the app.
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_duration_chk"
  CHECK ("duration_minutes" > 0 AND "duration_minutes" <= 360);
