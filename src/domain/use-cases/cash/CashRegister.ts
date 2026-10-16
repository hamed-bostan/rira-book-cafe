import { singleChange, type ActivityActor } from "../../entities/ActivityEntry";
import { cafeDayOf, shiftCafeDay } from "../../entities/CafeTime";
import {
  buildCashClose,
  cashDayFigures,
  unclosedCashDays,
  type CashClose,
  type CashCloseStatus,
  type CashCountInput,
  type CashDayFigures,
} from "../../entities/CashClose";
import { ValidationError } from "../../errors/ValidationError";

import type { Page, PageRequest } from "../../entities/Pagination";
import type { ICashRegisterRepository } from "../../repositories/ICashRegisterRepository";

/** How far back the dashboard looks for days that were never closed. */
export const UNCLOSED_LOOKBACK_DAYS = 60;

function assertNotFuture(day: string, now: Date): void {
  if (day > cafeDayOf(now)) throw new ValidationError("day", "That date is in the future.");
}

/**
 * What the till should hold for a day: the opening float, the day's cash in and
 * out (sales, refunds, expenses paid from the till) and the expected count. For
 * managers — the person counting does it blind.
 */
export class GetCashDay {
  constructor(private readonly cash: ICashRegisterRepository) {}

  async execute(day: string, now: Date = new Date()): Promise<CashDayFigures> {
    assertNotFuture(day, now);
    return cashDayFigures(await this.cash.daySnapshot(day));
  }
}

/** When the till was last closed, and which past days with cash activity are still waiting. */
export class GetCashCloseStatus {
  constructor(private readonly cash: ICashRegisterRepository) {}

  async execute(now: Date = new Date()): Promise<CashCloseStatus> {
    const today = cafeDayOf(now);
    const last = await this.cash.lastClose();
    const from = last && last.day >= shiftCafeDay(today, -UNCLOSED_LOOKBACK_DAYS) ? shiftCafeDay(last.day, 1) : shiftCafeDay(today, -UNCLOSED_LOOKBACK_DAYS);
    const active = from <= today ? await this.cash.cashActivityDays(from, today) : [];
    return {
      today,
      lastClosedDay: last?.day,
      todayClosed: last?.day === today,
      unclosedDays: unclosedCashDays(active, last?.day, today),
    };
  }
}

export class ListCashCloses {
  constructor(private readonly cash: ICashRegisterRepository) {}

  execute(page: PageRequest): Promise<Page<CashClose>> {
    return this.cash.listCloses(page);
  }
}

/**
 * Close the till for a day. The expected amount is recomputed inside the closing
 * transaction; the over/short goes to Cash over/short and any deposit to the bank,
 * in one entry, together with the close record and its audit entry. One close per
 * day, in order, never edited.
 */
export class CloseCashRegister {
  constructor(private readonly cash: ICashRegisterRepository) {}

  async execute(input: CashCountInput, actor: ActivityActor, now: Date = new Date()): Promise<CashClose> {
    assertNotFuture(input.day, now);
    return this.cash.close(
      input.day,
      (snapshot) => buildCashClose(snapshot, input, actor),
      (close) => ({
        actorId: actor.id,
        actorName: actor.name,
        action: "ledger.cashClosed",
        entityType: "ledger",
        entityId: close.id,
        entityLabel: `Cash close ${close.day}`,
        changes: [...singleChange("counted", null, close.counted), ...singleChange("difference", null, close.difference), ...singleChange("deposited", null, close.deposited)],
      }),
    );
  }
}
