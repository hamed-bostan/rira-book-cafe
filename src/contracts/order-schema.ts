import { z } from "zod";

import {
  MAX_LINE_QUANTITY,
  MAX_ORDER_NOTE_TEXT_LENGTH,
  MAX_TABLE_LABEL_LENGTH,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  SERVICE_TYPES,
  SETTABLE_PAYMENT_STATUSES,
} from "@/src/domain/entities/Order";

import { fieldsParsed } from "./fields-parsed";

/**
 * Order contracts shared by the route handlers and their clients (defensive
 * re-validation — never trust the client). Framework-free, so they stay importable
 * from both halves of the BFF. Validation messages are `formErrors` message keys.
 */

/** Most distinct lines in one order — a generous table, not a catering job. */
export const MAX_ORDER_LINES = 30;

/** Optional free text: trimmed, blank → `undefined`. */
function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, "noteTooLong")
    .optional()
    .transform((value) => (value ? value : undefined));
}

/** Longest promo code accepted as typed (codes themselves are 3–20 characters). */
const MAX_PROMO_INPUT_LENGTH = 30;

const orderLines = z
  .array(
    z.object({
      productId: z.string().min(1, "productRequired"),
      quantity: z.number().int("quantityWhole").min(1, "quantityMin").max(MAX_LINE_QUANTITY, "quantityMax"),
      note: optionalText(MAX_ORDER_NOTE_TEXT_LENGTH),
    }),
  )
  .min(1, "itemsRequired")
  .max(MAX_ORDER_LINES, "itemsTooMany");

/** The discounts a guest asks for: a promo code as typed, and whether to spend points. */
const discountFields = {
  promoCode: optionalText(MAX_PROMO_INPUT_LENGTH),
  redeemPoints: z.boolean().optional(),
};

/**
 * Placing an order. Only *which* items and how many — prices and names come from
 * the menu on the server, and so do the discounts. A dine-in order must name its
 * table.
 */
export const placeOrderSchema = z
  .object({
    items: orderLines,
    serviceType: z.enum(SERVICE_TYPES, { error: "serviceTypeInvalid" }),
    tableLabel: optionalText(MAX_TABLE_LABEL_LENGTH),
    note: optionalText(MAX_ORDER_NOTE_TEXT_LENGTH),
    ...discountFields,
  })
  .refine((data) => data.serviceType !== "dineIn" || data.tableLabel !== undefined, {
    path: ["tableLabel"],
    error: "tableRequired",
    when: fieldsParsed("items.*.note", "tableLabel", "note", "promoCode"),
  });

export type PlaceOrderInput = z.input<typeof placeOrderSchema>;

/** Previewing the basket's total with a promo code and/or points. */
export const quoteOrderSchema = z.object({ items: orderLines, ...discountFields });

export type QuoteOrderInput = z.input<typeof quoteOrderSchema>;

/** Staff moving an order along the workflow. The current status is read server-side. */
export const orderStatusChangeSchema = z.object({
  status: z.enum(ORDER_STATUSES, { error: "statusInvalid" }),
});

export type OrderStatusChangeInput = z.infer<typeof orderStatusChangeSchema>;

/** Staff ticking one line of an order off as served, or taking the tick back. */
export const orderItemServedSchema = z.object({
  served: z.boolean({ error: "statusInvalid" }),
});

export type OrderItemServedInput = z.infer<typeof orderItemServedSchema>;

/**
 * Staff marking an order paid (and how) or unpaid. `refunded` isn't settable — it
 * follows from cancelling a paid order. A method is required when marking paid: it
 * decides which account the money lands in.
 */
export const orderPaymentSchema = z
  .object({
    paymentStatus: z.enum(SETTABLE_PAYMENT_STATUSES, { error: "statusInvalid" }),
    paymentMethod: z.enum(PAYMENT_METHODS, { error: "methodInvalid" }).optional(),
  })
  .refine((value) => value.paymentStatus !== "paid" || value.paymentMethod !== undefined, {
    error: "methodRequired",
    path: ["paymentMethod"],
  });

export type OrderPaymentInput = z.infer<typeof orderPaymentSchema>;
