import { describe, expect, it } from "vitest";

import { sourceHref, sourceLinkKey } from "../accounting-format";

describe("sourceLinkKey", () => {
  it("names the document each kind of automatic entry links to", () => {
    expect(sourceLinkKey("orderSale")).toBe("entry.viewOrder");
    expect(sourceLinkKey("orderPaymentReversal")).toBe("entry.viewOrder");
    expect(sourceLinkKey("expense")).toBe("entry.viewExpense");
    expect(sourceLinkKey("expensePayment")).toBe("entry.viewExpense");
  });

  it("doesn't call a cash shift an expense", () => {
    expect(sourceHref({ source: "cashShift", sourceId: "shift-1" })).toBe("/dashboard/cash-shifts");
    expect(sourceLinkKey("cashShift")).toBe("entry.viewCashShifts");
  });
});
