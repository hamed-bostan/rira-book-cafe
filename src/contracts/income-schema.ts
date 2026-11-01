import {
  INCOME_METHODS,
  INCOME_SOURCE_TYPES,
  MAX_INCOME_DESCRIPTION_LENGTH,
  MAX_PAYER_NAME_LENGTH,
} from "@/src/domain/entities/Income";
import * as z from "@/src/lib/zod";

import { fieldsParsed } from "./fields-parsed";
import { dayField, moneyField, optionalMoneyField, optionalTextField } from "./money-fields";

/**
 * Recording money that came in outside an order. `amount` is the total received, VAT
 * included; `vatAmount` is the VAT inside it (blank: none), which must be less than it.
 */
export const incomeSchema = z
  .object({
    date: dayField,
    accountCode: z.string().check(z.trim(), z.minLength(1, "accountRequired")),
    description: z
      .string()
      .check(
        z.trim(),
        z.minLength(1, "descriptionRequired"),
        z.maxLength(MAX_INCOME_DESCRIPTION_LENGTH, "textTooLong"),
      ),
    amount: moneyField,
    vatAmount: optionalMoneyField,
    method: z.enum(INCOME_METHODS, { error: "paymentInvalid" }),
    payerName: optionalTextField(MAX_PAYER_NAME_LENGTH),
    sourceType: z.optional(z.enum(INCOME_SOURCE_TYPES, { error: "paymentInvalid" })),
    sourceId: z.optional(z.string()),
  })
  .check(
    z.refine((value) => value.vatAmount < value.amount, {
      path: ["vatAmount"],
      error: "vatTooHigh",
      when: fieldsParsed("amount", "vatAmount"),
    }),
  );

export type IncomeFormInput = z.input<typeof incomeSchema>;

/** Voiding income; the reason goes on the reversing entry. */
export const voidIncomeSchema = z.object({
  reason: z.string().check(z.trim(), z.maxLength(200, "textTooLong")),
});
