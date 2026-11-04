import { MAX_ORDER_AMOUNT } from "@/src/domain/entities/Order";
import { BOOK_AVAILABILITIES, MAX_BOOK_COPIES, MAX_STOCK_QUANTITY, PRODUCT_KINDS } from "@/src/domain/entities/Product";
import { DIETARY_TAGS } from "@/src/domain/entities/ProductFilters";
import {
  MAX_OPTION_CHOICES,
  MAX_OPTION_GROUPS,
  MAX_OPTION_NAME_LENGTH,
  normalizeOptionGroups,
  OPTION_SELECTIONS,
} from "@/src/domain/entities/ProductOptions";
import * as z from "@/src/lib/zod";

import { fieldsParsed } from "./fields-parsed";
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
  .pipe(
    z.string().check(z.trim(), z.minLength(1, "priceRequired"), z.regex(PRICE_PATTERN, "priceInvalid")),
    z.transform(Number),
  )
  .check(
    z.refine((n) => n > 0, "pricePositive"),
    z.refine((n) => n <= MAX_ORDER_AMOUNT, "amountTooLarge"),
  );

/** Optional price: blank → `undefined`; otherwise the same rules as `priceField`. */
const optionalPriceField = z
  .pipe(
    z
      .pipe(
        z.string().check(z.trim()),
        z.transform((value) => (value.length > 0 ? value : undefined)),
      )
      .check(z.refine((value) => value === undefined || PRICE_PATTERN.test(value), "priceInvalid")),
    z.transform((value) => (value === undefined ? undefined : Number(value))),
  )
  .check(z.refine((value) => value === undefined || value <= MAX_ORDER_AMOUNT, "amountTooLarge"));

/** A stock count: a non-negative whole number. */
const STOCK_PATTERN = /^\d+$/;

/** Optional free text: trimmed, blank → `undefined` so it isn't stored as "". */
const optionalText = z.pipe(
  z.string().check(z.trim()),
  z.transform((value) => (value.length > 0 ? value : undefined)),
);

/** Optional ISBN: separators stripped, upper-cased, blank → `undefined`. */
const isbnField = z
  .pipe(
    z.pipe(
      z.string(),
      z.transform((value) => value.replace(/[\s-]/g, "").toUpperCase()),
    ),
    z.transform((value) => (value.length > 0 ? value : undefined)),
  )
  .check(z.refine((value) => value === undefined || ISBN_PATTERN.test(value), "isbnInvalid"));

/**
 * Copies the lending shelf has, 0–MAX_BOOK_COPIES (0 when every copy is lost).
 * Optional on the wire (a client that predates the field sends none); blank or
 * absent reads as one.
 */
const copiesField = z
  .pipe(
    z.optional(z.string().check(z.trim())).check(z.refine((value) => !value || /^\d+$/.test(value), "copiesWhole")),
    z.transform((value) => (value ? Number(value) : undefined)),
  )
  .check(z.refine((value) => value === undefined || (value >= 0 && value <= MAX_BOOK_COPIES), "copiesRange"));

/** Dietary tags: a set of known tags (blank list allowed); the public filter reads these. */
const dietaryField = z
  ._default(z.array(z.string()), [])
  .check(z.refine((tags) => tags.every((tag) => DIETARY_SET.has(tag)), "dietaryUnknown"));

const productFieldsParsed = fieldsParsed("price", "originalPrice", "costPrice", "bookCopies");

/** An option's name: required, trimmed, short. */
const optionNameField = z
  .string()
  .check(z.trim(), z.minLength(1, "optionNameRequired"), z.maxLength(MAX_OPTION_NAME_LENGTH, "optionNameTooLong"));

/** An option's Persian name: optional; blank → `undefined` (the English one shows). */
const optionNameFaField = z.pipe(
  z.optional(z.string().check(z.trim(), z.maxLength(MAX_OPTION_NAME_LENGTH, "optionNameTooLong"))),
  z.transform((value) => (value ? value : undefined)),
);

/** What a choice adds to the price: whole Toman, 0 or more; blank is 0 (a free choice). */
const priceDeltaField = z
  .pipe(
    z.string().check(
      z.trim(),
      z.refine((value) => value === "" || PRICE_PATTERN.test(value), "priceInvalid"),
    ),
    z.transform((value) => (value === "" ? 0 : Number(value))),
  )
  .check(z.refine((n) => n <= MAX_ORDER_AMOUNT, "amountTooLarge"));

/** A count of choices: blank → `undefined`; otherwise a whole number. */
const choiceCountField = z
  .pipe(
    z.string().check(
      z.trim(),
      z.refine((value) => value === "" || /^\d+$/.test(value), "optionCountWhole"),
    ),
    z.transform((value) => (value === "" ? undefined : Number(value))),
  )
  .check(z.refine((n) => n === undefined || n <= MAX_OPTION_CHOICES, "optionMaxInvalid"));

const optionChoiceField = z.object({
  // The id of a choice the item already has; absent for a new one. The server keeps
  // only ids the item really has, so a forged one just makes a new choice.
  id: z.optional(z.string().check(z.maxLength(64, "optionUnknown"))),
  name: optionNameField,
  nameFa: optionNameFaField,
  priceDelta: priceDeltaField,
  isAvailable: z.boolean(),
  isDefault: z.boolean(),
});

/**
 * One option group as the form holds it. A single-choice group takes one choice at
 * most (exactly one when required) and may name a default when required; a
 * multiple-choice one takes between `minChoices` (when required; 1 if left blank)
 * and `maxChoices` (blank: as many as it has).
 */
const optionGroupField = z
  .object({
    id: z.optional(z.string().check(z.maxLength(64, "optionUnknown"))),
    name: optionNameField,
    nameFa: optionNameFaField,
    required: z.boolean(),
    selection: z.enum(OPTION_SELECTIONS, { error: "optionSelectionInvalid" }),
    minChoices: choiceCountField,
    maxChoices: choiceCountField,
    choices: z
      .array(optionChoiceField)
      .check(z.minLength(1, "optionChoicesRequired"), z.maxLength(MAX_OPTION_CHOICES, "optionChoicesTooMany")),
  })
  .check(
    z.superRefine(
      (group, ctx) => {
        const seen = new Set<string>();
        group.choices.forEach((choice, index) => {
          const key = choice.name.toLowerCase();
          if (seen.has(key)) {
            ctx.addIssue({ code: "custom", path: ["choices", index, "name"], message: "optionChoiceDuplicate" });
          }
          seen.add(key);
        });
        if (group.selection === "single") {
          if (group.required && group.choices.filter((choice) => choice.isDefault).length > 1) {
            ctx.addIssue({ code: "custom", path: ["choices"], message: "optionDefaultOne" });
          }
          return;
        }
        const max = group.maxChoices ?? group.choices.length;
        const min = group.required ? (group.minChoices ?? 1) : 0;
        if (max < 1 || max > group.choices.length) {
          ctx.addIssue({ code: "custom", path: ["maxChoices"], message: "optionMaxInvalid" });
        } else if (group.required && (min < 1 || min > max)) {
          ctx.addIssue({ code: "custom", path: ["minChoices"], message: "optionMinInvalid" });
        }
      },
      { when: fieldsParsed("minChoices", "maxChoices", "choices.*.priceDelta", "choices.*.nameFa", "nameFa") },
    ),
  );

/**
 * The item's option groups, in order. Optional on the wire: a client that sends
 * none (one that predates options) leaves the item's groups as they are; the form
 * always sends its list, so an empty one clears them.
 */
const optionGroupsField = z.optional(
  z.array(optionGroupField).check(z.maxLength(MAX_OPTION_GROUPS, "optionGroupsTooMany")),
);

export const productFormSchema = z.pipe(
  z
    .object({
      kind: z.enum(PRODUCT_KINDS, { error: "kindInvalid" }),
      name: z.string().check(z.trim(), z.minLength(1, "nameRequired"), z.maxLength(120, "nameTooLong")),
      categoryId: z.string().check(z.minLength(1, "categoryRequired")),
      price: priceField,
      originalPrice: optionalPriceField,
      // What one unit costs the cafe — optional; feeds cost of sales and margins.
      costPrice: optionalPriceField,
      imageUrl: imageUrlField("imageRequired"),
      // Required and validated only for a counted item — see the refinement below. A
      // made-to-order item isn't counted, so whatever the (hidden) field holds is ignored.
      stockQuantity: z.string().check(z.trim()),
      madeToOrder: z.boolean(),
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
      bookAvailability: z.enum(BOOK_AVAILABILITIES, { error: "availabilityInvalid" }),
      bookCopies: copiesField,
      // Persian (fa) content overrides — optional. A blank fa name means "no fa
      // translation" for this item (the public site falls back to the base row).
      faName: optionalText,
      faUnit: optionalText,
      faDescription: optionalText,
      faNutrition: optionalText,
      faOrigin: optionalText,
      // Sizes and extras (drinks and food only — a book's are dropped on parse).
      optionGroups: optionGroupsField,
    })
    .check(
      z.refine((data) => data.originalPrice === undefined || data.originalPrice > data.price, {
        path: ["originalPrice"],
        error: "originalPriceHigher",
        when: productFieldsParsed,
      }),
      z.refine((data) => data.kind !== "book" || data.bookAuthor !== undefined, {
        path: ["bookAuthor"],
        error: "authorRequired",
        when: productFieldsParsed,
      }),
      z.superRefine(
        (data, ctx) => {
          if (data.madeToOrder) return;
          if (data.stockQuantity.length === 0) {
            ctx.addIssue({ code: "custom", path: ["stockQuantity"], message: "stockRequired" });
          } else if (!STOCK_PATTERN.test(data.stockQuantity)) {
            ctx.addIssue({ code: "custom", path: ["stockQuantity"], message: "stockWhole" });
          } else if (Number(data.stockQuantity) > MAX_STOCK_QUANTITY) {
            ctx.addIssue({ code: "custom", path: ["stockQuantity"], message: "stockTooLarge" });
          }
        },
        { when: productFieldsParsed },
      ),
    ),
  z.transform(
    ({
      faName,
      faUnit,
      faDescription,
      faNutrition,
      faOrigin,
      bookAuthor,
      bookIsbn,
      bookAvailability,
      bookCopies,
      stockQuantity,
      optionGroups,
      ...base
    }) => ({
      ...base,
      // Positions are the lists' order; the bounds a group's kind doesn't use are
      // reset, and a default kept only on a required single-choice group.
      optionGroups:
        optionGroups === undefined
          ? undefined
          : base.kind === "book"
            ? []
            : normalizeOptionGroups(
                optionGroups.map(({ minChoices, maxChoices, ...group }) => ({
                  ...group,
                  minChoices: minChoices ?? 1,
                  maxChoices,
                })),
              ),
      // A made-to-order item sends no count, so saving it leaves the stored one alone.
      stockQuantity: base.madeToOrder ? undefined : Number(stockQuantity),
      // Book details only travel with books; for drinks and food they're dropped
      // even if the form still holds stale values from a kind switch.
      book:
        base.kind === "book" && bookAuthor !== undefined
          ? { author: bookAuthor, isbn: bookIsbn, availability: bookAvailability, copies: bookCopies }
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
  ),
);

/** Form value shape (what the controls hold). */
export type ProductFormInput = z.input<typeof productFormSchema>;
/** Validated payload shape (what the use-case receives) — matches `NewProduct`. */
export type ProductFormValues = z.output<typeof productFormSchema>;
