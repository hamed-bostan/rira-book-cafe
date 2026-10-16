import { z } from "zod";

import { dayField, moneyField, optionalMoneyField, optionalTextField } from "./money-fields";

/**
 * A payout from the online gateway as the bank statement shows it: the day it
 * arrived, what was deposited, the fee the gateway kept (blank: none) and the
 * payout's reference. The server re-checks the amounts against what the gateway
 * holds for the cafe.
 */
export const gatewaySettlementSchema = z.object({
  date: dayField,
  deposited: moneyField,
  fee: optionalMoneyField,
  reference: optionalTextField(80),
});

export type GatewaySettlementInput = z.input<typeof gatewaySettlementSchema>;
export type GatewaySettlementValues = z.output<typeof gatewaySettlementSchema>;
