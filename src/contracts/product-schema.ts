import { z } from "zod";

import { BOOK_AVAILABILITIES, PRODUCT_KINDS } from "@/src/domain/entities/Product";
import { DIETARY_TAGS } from "@/src/domain/entities/ProductFilters";

import { imageUrlField } from "./image-url";

const DIETARY_SET = new Set<string>(DIETARY_TAGS);

/**
 * The single source of truth for menu-item form input, shared by the client form
 * (React Hook Form resolver) and the REST route handlers (defensive re-validation
 * — never trust the client). Framework-free, so it stays importable from both.
 *
 * Numeric and optional-text fields are authored as strings (that's what the form
 * controls emit) and transformed to the domain shape on parse, so the schema's
 * *output* matches `NewProduct`: `z.input` is the form's value type, `z.output`
 * the validated payload the use-case receives.
 *
 * Validation messages are `formErrors` message keys, translated at display time
 * (see `src/lib/formErrorMessage.ts`).
 */

/** Prices are whole Toman. */
export const PRICE_PATTERN = /^\d+$/;

/** ISBN-10 or ISBN-13 once hyphens and spaces are stripped; ISBN-10 may end in X. */
export const ISBN_PATTERN = /^(?:\d{9}[\dX]|\d{13})$/;

/** Required price: a string the form emits, validated and coerced to a positive whole number. */
const priceField = z
  .string()
  .trim()
  .min(1, "priceRequired")
  .regex(PRICE_PATTERN, "priceInvalid")
  .transform(Number)
  .refine((n) => n > 0, "pricePositive");

/** Optional price: blank → `undefined`; otherwise the same rules as `priceField`. */
const optionalPriceField = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : undefined))
  .refine((value) => value === undefined || PRICE_PATTERN.test(value), "priceInvalid")
  .transform((value) => (value === undefined ? undefined : Number(value)));

/** Required stock: a string the form emits, validated as a non-negative whole number. */
const stockField = z.string().trim().min(1, "stockRequired").regex(/^\d+$/, "stockWhole").transform(Number);

/** Optional free text: trimmed, blank → `undefined` so it isn't stored as "". */
const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : undefined));

/** Optional ISBN: separators stripped, upper-cased, blank → `undefined`. */
const isbnField = z
  .string()
  .transform((value) => value.replace(/[\s-]/g, "").toUpperCase())
  .transform((value) => (value.length > 0 ? value : undefined))
  .refine((value) => value === undefined || ISBN_PATTERN.test(value), "isbnInvalid");

/** Dietary tags: a set of known tags (blank list allowed); the public filter reads these. */
const dietaryField = z
  .array(z.string())
  .default([])
  .refine((tags) => tags.every((tag) => DIETARY_SET.has(tag)), "dietaryUnknown");

export const productFormSchema = z
  .object({
    kind: z.enum(PRODUCT_KINDS, { message: "kindInvalid" }),
    name: z.string().trim().min(1, "nameRequired").max(120, "nameTooLong"),
    categoryId: z.string().min(1, "categoryRequired"),
    price: priceField,
    originalPrice: optionalPriceField,
    // What one unit costs the cafe — optional; feeds cost of sales and margins.
    costPrice: optionalPriceField,
    imageUrl: imageUrlField("imageRequired"),
    stockQuantity: stockField,
    isFeatured: z.boolean(),
    isPublished: z.boolean(),
    badge: optionalText,
    unit: optionalText,
    description: optionalText,
    nutrition: optionalText,
    origin: optionalText,
    dietary: dietaryField,
    taxExempt: z.boolean(),
    // Book-only fields. Always present in the form (blank for drinks/food) and
    // required only when `kind` is "book" — see the refinements below.
    bookAuthor: optionalText,
    bookIsbn: isbnField,
    bookAvailability: z.enum(BOOK_AVAILABILITIES, { message: "availabilityInvalid" }),
    // Persian (fa) content overrides — optional. A blank fa name means "no fa
    // translation" for this item (the public site falls back to the base row).
    faName: optionalText,
    faUnit: optionalText,
    faDescription: optionalText,
    faNutrition: optionalText,
    faOrigin: optionalText,
  })
  .refine((data) => data.originalPrice === undefined || data.originalPrice > data.price, {
    path: ["originalPrice"],
    message: "originalPriceHigher",
  })
  .refine((data) => data.kind !== "book" || data.bookAuthor !== undefined, {
    path: ["bookAuthor"],
    message: "authorRequired",
  })
  .transform(
    ({ faName, faUnit, faDescription, faNutrition, faOrigin, bookAuthor, bookIsbn, bookAvailability, ...base }) => ({
      ...base,
      // Book details only travel with books; for drinks and food they're dropped
      // even if the form still holds stale values from a kind switch.
      book:
        base.kind === "book" && bookAuthor !== undefined
          ? { author: bookAuthor, isbn: bookIsbn, availability: bookAvailability }
          : undefined,
      // Only author a translation when a localized name is provided (the DB requires
      // it); clearing the name drops the fa translation on save.
      translations: faName
        ? [
            {
              locale: "fa",
              name: faName,
              unit: faUnit,
              description: faDescription,
              nutrition: faNutrition,
              origin: faOrigin,
            },
          ]
        : [],
    }),
  );

/** Form value shape (what the controls hold). */
export type ProductFormInput = z.input<typeof productFormSchema>;
/** Validated payload shape (what the use-case receives) — matches `NewProduct`. */
export type ProductFormValues = z.output<typeof productFormSchema>;
