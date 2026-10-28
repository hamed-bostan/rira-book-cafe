import { MAX_EXPENSE_DESCRIPTION_LENGTH } from "@/src/domain/entities/Expense";
import * as z from "@/src/lib/zod";

import { EXPENSE_PAYMENT_CHOICES } from "./expense-schema";
import { fieldsParsed } from "./fields-parsed";
import { countField, dayField, optionalMoneyField, optionalTextField, quantityField } from "./money-fields";

/** The most lines one delivery, count or opening document may carry. */
const MAX_LINES = 200;

const pricedLine = z.object({
  ingredientId: z.string().check(z.trim(), z.minLength(1, "ingredientRequired")),
  quantity: quantityField,
  /** What the line cost before VAT, whole Toman. */
  cost: optionalMoneyField,
});

/** A delivery from a supplier: what came in, each line's cost before VAT, the invoice VAT, and payment. */
export const stockReceiptSchema = z.pipe(
  z
    .object({
      date: dayField,
      supplierId: z.pipe(
        z.string().check(z.trim()),
        z.transform((value) => (value === "" ? undefined : value)),
      ),
      description: z
        .string()
        .check(
          z.trim(),
          z.minLength(1, "descriptionRequired"),
          z.maxLength(MAX_EXPENSE_DESCRIPTION_LENGTH, "textTooLong"),
        ),
      lines: z.array(pricedLine).check(z.minLength(1, "linesTooFew"), z.maxLength(MAX_LINES, "linesTooMany")),
      vatAmount: optionalMoneyField,
      payment: z.enum(EXPENSE_PAYMENT_CHOICES, { error: "paymentInvalid" }),
    })
    .check(
      z.refine((value) => value.lines.some((line) => line.cost > 0), {
        path: ["lines"],
        error: "deliveryTotalRequired",
        when: fieldsParsed("lines.*.quantity", "lines.*.cost", "vatAmount"),
      }),
    ),
  z.transform(({ payment, ...rest }) => ({ ...rest, paidFrom: payment === "unpaid" ? undefined : payment })),
);

export type StockReceiptFormInput = z.input<typeof stockReceiptSchema>;

/** Stock that was spoiled, spilled or expired. */
export const wasteSchema = z.object({
  date: dayField,
  ingredientId: z.string().check(z.trim(), z.minLength(1, "ingredientRequired")),
  quantity: quantityField,
  note: optionalTextField(200),
});

export type WasteFormInput = z.input<typeof wasteSchema>;

/** A physical count. Only the items actually counted are sent. */
export const stockCountSchema = z.object({
  date: dayField,
  lines: z.array(z.object({ ingredientId: z.string().check(z.trim(), z.minLength(1)), counted: countField })).check(
    z.minLength(1, "linesTooFew"),
    z.maxLength(MAX_LINES, "linesTooMany"),
    z.refine((lines) => new Set(lines.map((line) => line.ingredientId)).size === lines.length, {
      error: "ingredientRepeated",
      when: fieldsParsed("*.counted"),
    }),
  ),
  note: optionalTextField(200),
});

export type StockCountFormInput = z.input<typeof stockCountSchema>;

/** Stock on the shelves when tracking starts, at what it's worth. */
export const openingStockSchema = z.object({
  date: dayField,
  lines: z.array(pricedLine).check(z.minLength(1, "linesTooFew"), z.maxLength(MAX_LINES, "linesTooMany")),
});

export type OpeningStockFormInput = z.input<typeof openingStockSchema>;

/** The level at or below which an item shows as running low; blank clears it. */
export const reorderLevelSchema = z.object({
  reorderLevel: z.pipe(
    z.pipe(
      z.string().check(z.trim()),
      z.transform((value) => (value === "" ? null : value)),
    ),
    z.nullable(countField),
  ),
});

export type ReorderLevelInput = z.input<typeof reorderLevelSchema>;

/** Closing a Persian fiscal year, e.g. 1404. */
export const yearCloseSchema = z.object({ year: z.number().check(z.int(), z.gte(1300), z.lte(1600)) });
