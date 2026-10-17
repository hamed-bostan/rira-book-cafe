import { describe, expect, it } from "vitest";

import { gatewaySettlementSchema, type GatewaySettlementInput } from "../payment-schema";

const SETTLEMENT: GatewaySettlementInput = {
  date: "2026-10-17",
  deposited: "980000",
  fee: "",
  reference: " PAY-77 ",
};

describe("gatewaySettlementSchema", () => {
  it("parses the deposit, reads a blank fee as none and trims the reference", () => {
    expect(gatewaySettlementSchema.parse(SETTLEMENT)).toEqual({ date: "2026-10-17", deposited: 980000, fee: 0, reference: "PAY-77" });
    expect(gatewaySettlementSchema.parse({ ...SETTLEMENT, fee: "20000", reference: "" })).toMatchObject({ fee: 20000, reference: undefined });
  });

  it("maps each invalid field to its message key", () => {
    const fieldErrors = gatewaySettlementSchema.safeParse({ date: "17 Oct", deposited: "0", fee: "x", reference: "r".repeat(81) }).error?.flatten()
      .fieldErrors;
    expect(fieldErrors).toEqual({
      date: ["dateInvalid"],
      deposited: ["amountInvalid"],
      fee: ["amountInvalid"],
      reference: ["textTooLong"],
    });
  });

  it("requires a deposit", () => {
    expect(gatewaySettlementSchema.safeParse({ ...SETTLEMENT, deposited: "" }).error?.flatten().fieldErrors.deposited).toContain("amountRequired");
  });
});
