import type { AuditHook } from "./AuditHook";
import type { RecurringBill } from "../entities/RecurringBill";

export type NewRecurringBill = Pick<
  RecurringBill,
  "description" | "accountCode" | "supplierId" | "amount" | "vatAmount" | "dayOfMonth" | "startsOn"
>;

export type RecurringBillChanges = Omit<NewRecurringBill, "startsOn"> & { isActive: boolean };

export type IRecurringBillRepository = {
  /** Every bill, switched off or not, by description. */
  list(): Promise<RecurringBill[]>;
  get(id: string): Promise<RecurringBill | null>;
  /** Bills still running, each with the months already recorded or skipped. */
  listActiveWithDone(): Promise<{ bill: RecurringBill; done: string[] }[]>;
  create(input: NewRecurringBill, audit?: AuditHook<RecurringBill>): Promise<RecurringBill>;
  update(id: string, input: RecurringBillChanges, audit?: AuditHook<RecurringBill>): Promise<RecurringBill>;
  /** Mark a month as not owed; `ALREADY_POSTED` when it's already been dealt with. */
  skip(
    bill: RecurringBill,
    period: string,
    actor: { id: string; name: string },
    audit?: AuditHook<RecurringBill>,
  ): Promise<void>;
};
