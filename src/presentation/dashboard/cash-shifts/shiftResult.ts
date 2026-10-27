/** How a closed shift's count came out against the books. */
export type ShiftResultKind = "exact" | "over" | "short";

export type ShiftResult = {
  kind: ShiftResultKind;
  /** The over or short, as a positive amount of Toman (0 when exact). */
  amount: number;
  /** The badge tone: exact is settled, over is worth a look, short is money missing. */
  variant: "success" | "info" | "error";
};

/** Reads a shift's counted − expected as exact, over or short. */
export function shiftResult(difference: number): ShiftResult {
  if (difference === 0) return { kind: "exact", amount: 0, variant: "success" };
  return difference > 0
    ? { kind: "over", amount: difference, variant: "info" }
    : { kind: "short", amount: -difference, variant: "error" };
}
