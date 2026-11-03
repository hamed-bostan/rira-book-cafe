import {
  COUNTER_PAYMENT_METHODS,
  MAX_COUNTER_CUSTOMER_LENGTH,
  MAX_LINE_QUANTITY,
  MAX_ORDER_LINES,
  MAX_ORDER_NOTE_TEXT_LENGTH,
  MAX_TABLE_LABEL_LENGTH,
  MAX_WRITE_OFF_REASON_LENGTH,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  SERVICE_TYPES,
  SETTABLE_PAYMENT_STATUSES,
} from "@/src/domain/entities/Order";
import { MAX_REFUND_REASON_LENGTH } from "@/src/domain/entities/OrderRefund";
import * as z from "@/src/lib/zod";

import { fieldsParsed } from "./fields-parsed";
import { MAX_MONEY_AMOUNT } from "./money-fields";

/**
 * Order contracts shared by the route handlers and their clients (defensive
 * re-validation — never trust the client). Framework-free, so they stay importable
 * from both halves of the BFF. Validation messages are `formErrors` message keys.
 */

/** Optional free text: trimmed, blank → `undefined`. */
function optionalText(max: number) {
  return z.pipe(
    z.optional(z.string().check(z.trim(), z.maxLength(max, "noteTooLong"))),
    z.transform((value) => (value ? value : undefined)),
  );
}

/** Longest phone number staff can type on a counter sale. */
const MAX_COUNTER_PHONE_LENGTH = 30;

/** Longest promo code accepted as typed (codes themselves are 3–20 characters). */
const MAX_PROMO_INPUT_LENGTH = 30;

const orderLines = z
  .array(
    z.object({
      productId: z.string().check(z.minLength(1, "productRequired")),
      quantity: z
        .number()
        .check(z.int("quantityWhole"), z.gte(1, "quantityMin"), z.lte(MAX_LINE_QUANTITY, "quantityMax")),
      note: optionalText(MAX_ORDER_NOTE_TEXT_LENGTH),
    }),
  )
  .check(z.minLength(1, "itemsRequired"), z.maxLength(MAX_ORDER_LINES, "itemsTooMany"));

/** The discounts a guest asks for: a promo code as typed, and whether to spend points. */
const discountFields = {
  promoCode: optionalText(MAX_PROMO_INPUT_LENGTH),
  redeemPoints: z.optional(z.boolean()),
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
  .check(
    z.refine((data) => data.serviceType !== "dineIn" || data.tableLabel !== undefined, {
      path: ["tableLabel"],
      error: "tableRequired",
      when: fieldsParsed("items.*.note", "tableLabel", "note", "promoCode"),
    }),
  );

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
 * A way staff may say the guest paid. Never `online`: only the gateway's callback
 * books that (see `COUNTER_PAYMENT_METHODS`), so every staff route refuses it.
 */
const counterPaymentMethod = z.enum(COUNTER_PAYMENT_METHODS, { error: "methodInvalid" });

/** How much came in by which method. The use-case checks the parts add up to the bill. */
const paymentParts = z
  .array(
    z.object({
      method: counterPaymentMethod,
      amount: z
        .number()
        .check(z.int("amountInvalid"), z.gt(0, "amountInvalid"), z.lte(MAX_MONEY_AMOUNT, "amountInvalid")),
    }),
  )
  .check(z.minLength(1, "methodRequired"), z.maxLength(COUNTER_PAYMENT_METHODS.length, "paymentPartsDuplicate"));

/**
 * Staff marking an order paid (and how) or unpaid. `refunded` isn't settable — it
 * follows from cancelling a paid order or refunding all of it. How it was paid is
 * required when marking paid, a method or a split's parts: it decides which accounts
 * the money lands in.
 */
export const orderPaymentSchema = z
  .object({
    paymentStatus: z.enum(SETTABLE_PAYMENT_STATUSES, { error: "statusInvalid" }),
    paymentMethod: z.optional(counterPaymentMethod),
    paymentParts: z.optional(paymentParts),
  })
  .check(
    z.refine(
      (value) =>
        value.paymentStatus !== "paid" || value.paymentMethod !== undefined || value.paymentParts !== undefined,
      { error: "methodRequired", path: ["paymentMethod"] },
    ),
  );

export type OrderPaymentInput = z.infer<typeof orderPaymentSchema>;

/**
 * A sale staff ring up at the counter. Only *which* items, like a guest's order: the
 * prices come from the menu. Paid now when it carries `paymentParts`; handed over on
 * the spot with `complete`.
 */
export const counterOrderSchema = z
  .object({
    items: orderLines,
    serviceType: z.enum(SERVICE_TYPES, { error: "serviceTypeInvalid" }),
    tableLabel: optionalText(MAX_TABLE_LABEL_LENGTH),
    note: optionalText(MAX_ORDER_NOTE_TEXT_LENGTH),
    customerName: z
      .string()
      .check(z.trim(), z.minLength(1, "nameRequired"), z.maxLength(MAX_COUNTER_CUSTOMER_LENGTH, "nameTooLong")),
    customerPhone: z.optional(z.string().check(z.trim(), z.maxLength(MAX_COUNTER_PHONE_LENGTH, "phoneInvalid"))),
    paymentParts: z.optional(paymentParts),
    complete: z.optional(z.boolean()),
  })
  .check(
    z.refine((data) => data.serviceType !== "dineIn" || data.tableLabel !== undefined, {
      path: ["tableLabel"],
      error: "tableRequired",
      when: fieldsParsed("items.*.note", "tableLabel", "note", "customerName", "customerPhone"),
    }),
  );

export type CounterOrderFormInput = z.input<typeof counterOrderSchema>;

/** Staff refunding units of a completed order. */
export const orderRefundSchema = z.object({
  lines: z
    .array(
      z.object({
        itemId: z.string().check(z.minLength(1, "refundLineUnknown")),
        quantity: z
          .number()
          .check(
            z.int("refundQuantityInvalid"),
            z.gte(1, "refundQuantityInvalid"),
            z.lte(MAX_LINE_QUANTITY, "refundQuantityInvalid"),
          ),
        restock: z.boolean(),
      }),
    )
    .check(z.minLength(1, "refundLinesRequired"), z.maxLength(MAX_ORDER_LINES, "refundLinesRequired")),
  method: z.enum(PAYMENT_METHODS, { error: "methodInvalid" }),
  reason: optionalText(MAX_REFUND_REASON_LENGTH),
});

export type OrderRefundInput = z.input<typeof orderRefundSchema>;

/** Writing off a served order nobody paid for: why, if staff want to say. */
export const orderWriteOffSchema = z.object({
  reason: optionalText(MAX_WRITE_OFF_REASON_LENGTH),
});

export type OrderWriteOffInput = z.input<typeof orderWriteOffSchema>;
