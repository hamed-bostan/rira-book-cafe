import { MAX_EXPENSE_DESCRIPTION_LENGTH, PAYMENT_SOURCES } from "@/src/domain/entities/Expense";
import { ADJUSTMENT_REASONS, adjustmentFitsReason, adjustmentNeedsNote } from "@/src/domain/entities/Inventory";
import {
  INGREDIENT_UNITS,
  MAX_PURCHASE_UNIT_FACTOR,
  MAX_PURCHASE_UNIT_NAME_LENGTH,
  MAX_PURCHASE_UNITS,
} from "@/src/domain/entities/Pricing";
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

/** Whether a delivery line's cost is for the whole line or for each unit typed. */
export const COST_PER = ["line", "unit"] as const;

/**
 * A delivery line: the quantity in the item's base unit, or in one of its purchase
 * units (`unit`, blank for the base unit), and its cost for the line or per unit.
 * The server converts with the item's own units — the client only names one.
 */
const receiptLine = z.object({
  ingredientId: z.string().check(z.trim(), z.minLength(1, "ingredientRequired")),
  quantity: quantityField,
  unit: z._default(z.string().check(z.trim(), z.maxLength(MAX_PURCHASE_UNIT_NAME_LENGTH, "textTooLong")), ""),
  /** Before VAT, whole Toman: for the line, or per unit typed. */
  cost: optionalMoneyField,
  costPer: z._default(z.enum(COST_PER, { error: "costPerInvalid" }), "line"),
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
      lines: z.array(receiptLine).check(z.minLength(1, "linesTooFew"), z.maxLength(MAX_LINES, "linesTooMany")),
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
  z.transform(({ payment, lines, ...rest }) => ({
    ...rest,
    lines: lines.map(({ unit, costPer, ...line }) => ({
      ...line,
      purchaseUnit: unit || undefined,
      costPerUnit: costPer === "unit",
    })),
    paidFrom: payment === "unpaid" ? undefined : payment,
  })),
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

/** A level as typed — blank clears it. */
const optionalLevelField = z.pipe(
  z.pipe(
    z.string().check(z.trim()),
    z.transform((value) => (value === "" ? null : value)),
  ),
  z.nullable(countField),
);

/** Which way a manual adjustment moved the stock. */
export const ADJUSTMENT_DIRECTION_CHOICES = ["in", "out"] as const;

/** A manual adjustment: which way, how much, why — and a note, which "other" must have. */
export const stockAdjustmentSchema = z.pipe(
  z
    .object({
      date: dayField,
      ingredientId: z.string().check(z.trim(), z.minLength(1, "ingredientRequired")),
      direction: z.enum(ADJUSTMENT_DIRECTION_CHOICES, { error: "directionInvalid" }),
      quantity: quantityField,
      reason: z.enum(ADJUSTMENT_REASONS, { error: "adjustmentReasonRequired" }),
      note: optionalTextField(200),
    })
    .check(
      z.refine((value) => !adjustmentNeedsNote(value.reason) || value.note !== undefined, {
        path: ["note"],
        error: "adjustmentNoteRequired",
        when: fieldsParsed("quantity", "note"),
      }),
      z.refine(
        (value) => adjustmentFitsReason(value.reason, value.direction === "in" ? value.quantity : -value.quantity),
        { path: ["direction"], error: "adjustmentDirection", when: fieldsParsed("quantity", "note") },
      ),
    ),
  z.transform(({ direction, quantity, ...rest }) => ({
    ...rest,
    quantity: direction === "in" ? quantity : -quantity,
  })),
);

export type StockAdjustmentFormInput = z.input<typeof stockAdjustmentSchema>;

/** Where a credit the delivery's bill can't take comes back to; blank when none needs to. */
export const REFUND_CHOICES = ["", ...PAYMENT_SOURCES] as const;

/** Stock going back to a supplier, and the credit note for it. */
export const supplierReturnSchema = z.pipe(
  z
    .object({
      date: dayField,
      supplierId: z.string().check(z.trim(), z.minLength(1, "supplierRequired")),
      expenseId: z.pipe(
        z.string().check(z.trim()),
        z.transform((value) => (value === "" ? undefined : value)),
      ),
      lines: z
        .array(
          z.object({
            ingredientId: z.string().check(z.trim(), z.minLength(1, "ingredientRequired")),
            quantity: quantityField,
          }),
        )
        .check(
          z.minLength(1, "linesTooFew"),
          z.maxLength(MAX_LINES, "linesTooMany"),
          z.refine((lines) => new Set(lines.map((line) => line.ingredientId)).size === lines.length, {
            error: "ingredientRepeated",
            when: fieldsParsed("*.quantity"),
          }),
        ),
      creditAmount: optionalMoneyField,
      vatAmount: optionalMoneyField,
      refundTo: z.enum(REFUND_CHOICES, { error: "paymentInvalid" }),
      note: optionalTextField(200),
    })
    .check(
      z.refine((value) => value.vatAmount <= value.creditAmount, {
        path: ["vatAmount"],
        error: "vatOverCredit",
        when: fieldsParsed("creditAmount", "vatAmount", "lines.*.quantity", "note"),
      }),
    ),
  z.transform(({ refundTo, ...rest }) => ({ ...rest, refundTo: refundTo === "" ? undefined : refundTo })),
);

export type SupplierReturnFormInput = z.input<typeof supplierReturnSchema>;

/**
 * A stock item as Inventory makes and edits it: its name and unit, the levels it's
 * reordered at and topped up to, the packs it's bought in and who it's usually
 * bought from. What it costs is Pricing's (and the deliveries').
 */
export const stockItemSchema = z
  .object({
    name: z.string().check(z.trim(), z.minLength(1, "nameRequired"), z.maxLength(80, "textTooLong")),
    unit: z.enum(INGREDIENT_UNITS, { error: "unitInvalid" }),
    reorderLevel: optionalLevelField,
    parLevel: optionalLevelField,
    purchaseUnits: z
      .array(
        z.object({
          name: z
            .string()
            .check(
              z.trim(),
              z.minLength(1, "purchaseUnitNameInvalid"),
              z.maxLength(MAX_PURCHASE_UNIT_NAME_LENGTH, "purchaseUnitNameInvalid"),
            ),
          factor: quantityField.check(z.refine((n) => n <= MAX_PURCHASE_UNIT_FACTOR, "purchaseUnitFactorInvalid")),
        }),
      )
      .check(
        z.maxLength(MAX_PURCHASE_UNITS, "purchaseUnitsTooMany"),
        z.refine((units) => new Set(units.map((unit) => unit.name.toLocaleLowerCase())).size === units.length, {
          error: "purchaseUnitRepeated",
          when: fieldsParsed("*.factor"),
        }),
      ),
    supplierId: z.pipe(
      z.string().check(z.trim()),
      z.transform((value) => (value === "" ? null : value)),
    ),
  })
  .check(
    z.refine(
      (value) => value.parLevel === null || value.reorderLevel === null || value.parLevel >= value.reorderLevel,
      {
        path: ["parLevel"],
        error: "parBelowReorder",
        when: fieldsParsed("reorderLevel", "parLevel", "purchaseUnits.*.factor"),
      },
    ),
    z.refine((value) => value.purchaseUnits.every((unit) => unit.name !== value.unit), {
      path: ["purchaseUnits"],
      error: "purchaseUnitNameInvalid",
      when: fieldsParsed("reorderLevel", "parLevel", "purchaseUnits.*.factor"),
    }),
  );

export type StockItemFormInput = z.input<typeof stockItemSchema>;

/** Closing a Persian fiscal year, e.g. 1404. */
export const yearCloseSchema = z.object({ year: z.number().check(z.int(), z.gte(1300), z.lte(1600)) });
