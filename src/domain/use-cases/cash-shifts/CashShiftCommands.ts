import {
  activityValue,
  type ActivityActor,
  type ActivityChange,
  type NewActivityEntry,
} from "../../entities/ActivityEntry";
import { cafeDayOf } from "../../entities/CafeTime";
import {
  MAX_DRAWER_AMOUNT,
  MAX_SHIFT_NOTE_LENGTH,
  expectedDrawer,
  type CashShift,
  type CashShiftReport,
} from "../../entities/CashShift";
import { cashOverShortEntry } from "../../entities/Postings";
import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";

import type { ICashShiftRepository } from "../../repositories/ICashShiftRepository";

/** How many past shifts the page lists. */
export const RECENT_SHIFTS_LIMIT = 30;

function validAmount(field: string, value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > MAX_DRAWER_AMOUNT) {
    throw new ValidationError(field, "Enter a whole number of Toman.");
  }
  return value;
}

function validNote(note: string | undefined): string | undefined {
  const trimmed = note?.trim() || undefined;
  if (trimmed && trimmed.length > MAX_SHIFT_NOTE_LENGTH) throw new ValidationError("note", "That note is too long.");
  return trimmed;
}

/** Start a shift with the cash put in the drawer. One shift at a time. */
export class OpenCashShift {
  constructor(private readonly shiftRepo: ICashShiftRepository) {}

  async execute(input: { openingFloat: number; note?: string }, staff: ActivityActor): Promise<CashShift> {
    const openingFloat = validAmount("openingFloat", input.openingFloat);
    if (await this.shiftRepo.getOpen()) throw new ConflictError("SHIFT_ALREADY_OPEN", "A shift is already open.");
    return this.shiftRepo.open({ openingFloat, note: validNote(input.note), by: staff }, (opened) =>
      shiftEntry(staff, "cashShift.opened", opened, [
        { field: "openingFloat", before: null, after: String(opened.openingFloat) },
      ]),
    );
  }
}

/**
 * A shift's activity entry, labelled with its number (`Z-12`) as staff call it.
 * The figures are the drawer's, which the shift screen already shows to whoever
 * holds `shifts.manage` — the same permission that reads these entries.
 */
function shiftEntry(
  staff: ActivityActor,
  action: "cashShift.opened" | "cashShift.closed",
  shift: CashShift,
  changes: ActivityChange[],
): NewActivityEntry {
  return {
    actorId: staff.id,
    actorName: staff.name,
    action,
    entityType: "cashShift",
    entityId: shift.id,
    entityLabel: `Z-${shift.number}`,
    changes,
  };
}

/**
 * End a shift by counting the drawer. The expected cash is worked out from the
 * books at that moment; any difference is posted as cash over or short, so the
 * Cash account ends the shift matching what's really in the drawer.
 */
export class CloseCashShift {
  constructor(private readonly shiftRepo: ICashShiftRepository) {}

  async execute(
    id: string,
    input: { countedCash: number; note?: string },
    staff: ActivityActor,
    now: Date,
  ): Promise<CashShift> {
    const countedCash = validAmount("countedCash", input.countedCash);
    const note = validNote(input.note);
    const shift = await this.shiftRepo.getById(id);
    if (!shift) throw new NotFoundError("cash shift", id);
    if (shift.status !== "open") throw new ConflictError("NO_OPEN_SHIFT", "This shift is already closed.");

    return this.shiftRepo.close(
      id,
      { countedCash, note, by: staff, at: now },
      (closed) => {
        const entry = cashOverShortEntry(closed, cafeDayOf(now), staff);
        return entry ? [entry] : [];
      },
      (closed) =>
        shiftEntry(staff, "cashShift.closed", closed, [
          { field: "status", before: "open", after: "closed" },
          { field: "expectedCash", before: null, after: activityValue(closed.expectedCash) },
          { field: "countedCash", before: null, after: activityValue(closed.countedCash) },
          { field: "difference", before: null, after: activityValue(closed.difference) },
        ]),
    );
  }
}

/** The open shift with its figures so far, or `null` between shifts. */
export class GetCurrentCashShift {
  constructor(private readonly shiftRepo: ICashShiftRepository) {}

  async execute(now: Date): Promise<CashShiftReport | null> {
    const shift = await this.shiftRepo.getOpen();
    if (!shift) return null;
    const movements = await this.shiftRepo.movements(new Date(shift.openedAt), now);
    return { shift, movements, expectedCash: expectedDrawer(shift.openingFloat, movements) };
  }
}

/** Past shifts, newest first. */
export class ListCashShifts {
  constructor(private readonly shiftRepo: ICashShiftRepository) {}

  execute(): Promise<CashShift[]> {
    return this.shiftRepo.list(RECENT_SHIFTS_LIMIT);
  }
}
