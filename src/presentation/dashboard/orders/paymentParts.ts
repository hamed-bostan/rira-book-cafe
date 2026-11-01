import { COUNTER_PAYMENT_METHODS, type PaymentMethod, type PaymentPart } from "@/src/domain/entities/Order";
import { normalizeAmount } from "@/src/presentation/dashboard/expenses/expenseFormat";

/** What's typed against each method while a bill is being split. */
export type SplitAmounts = Partial<Record<PaymentMethod, string>>;

/** The typed amounts as parts; methods left blank or at zero are out of the split. */
export function splitParts(amounts: SplitAmounts): PaymentPart[] {
  return COUNTER_PAYMENT_METHODS.flatMap((method) => {
    const amount = Number(normalizeAmount(amounts[method] ?? ""));
    return Number.isSafeInteger(amount) && amount > 0 ? [{ method, amount }] : [];
  });
}

/** How far the parts are from the bill: positive is still to assign, negative is too much. */
export function splitRemainder(parts: readonly PaymentPart[], total: number): number {
  return total - parts.reduce((sum, part) => sum + part.amount, 0);
}
