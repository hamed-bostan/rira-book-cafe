import {
  MAX_CAFE_ADDRESS_LENGTH,
  MAX_CAFE_NAME_LENGTH,
  MAX_CAFE_PHONE_LENGTH,
  MAX_CAFE_URL_LENGTH,
  MAX_HOURS_EXCEPTIONS,
  MAX_HOURS_NOTE_LENGTH,
  MAX_RECEIPT_HEADER_LINES,
  MAX_RECEIPT_TEXT_LENGTH,
  WEEKDAYS,
  instagramHandle,
  isClockTime,
  type Weekday,
} from "@/src/domain/entities/CafeSettings";
import * as z from "@/src/lib/zod";

import { fieldsParsed } from "./fields-parsed";
import { dayField, optionalTextField } from "./money-fields";

/**
 * The cafe's settings as the dashboard's forms send them, shared by the route
 * handlers and the forms. Every value arrives as the control emits it (strings, a
 * checkbox's boolean); messages are `formErrors` keys. The use-cases re-check the
 * same rules on the way in.
 */

const PHONE = /^\+?[0-9][0-9 ()-]{3,}$/;
const INSTAGRAM_HANDLE = /^[A-Za-z0-9._]{1,30}$/;
const COORDINATE = /^-?\d{1,3}(\.\d+)?$/;

function isWebAddress(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname.includes(".");
  } catch {
    return false;
  }
}

/** Optional text that must match a rule when it's filled in. */
function optionalChecked(max: number, valid: (value: string) => boolean, message: string) {
  return z.pipe(
    z.string().check(
      z.trim(),
      z.maxLength(max, "textTooLong"),
      z.refine((value) => value === "" || valid(value), message),
    ),
    z.transform((value) => (value.length > 0 ? value : undefined)),
  );
}

/** A coordinate as typed: blank, or degrees with decimals, within `limit` of zero. */
function coordinateField(limit: number) {
  return z.pipe(
    z.string().check(
      z.trim(),
      z.refine(
        (value) => value === "" || (COORDINATE.test(value) && Math.abs(Number(value)) <= limit),
        "coordinateInvalid",
      ),
    ),
    z.transform((value) => (value === "" ? undefined : Number(value))),
  );
}

/** Who and where the cafe is. Blank fields are cleared (the site falls back or leaves them out). */
export const cafeProfileSchema = z
  .object({
    name: optionalTextField(MAX_CAFE_NAME_LENGTH),
    nameFa: optionalTextField(MAX_CAFE_NAME_LENGTH),
    address: optionalTextField(MAX_CAFE_ADDRESS_LENGTH),
    addressFa: optionalTextField(MAX_CAFE_ADDRESS_LENGTH),
    phone: optionalChecked(MAX_CAFE_PHONE_LENGTH, (value) => PHONE.test(value), "phoneInvalid"),
    instagram: optionalChecked(
      MAX_CAFE_URL_LENGTH,
      (value) => INSTAGRAM_HANDLE.test(instagramHandle(value)),
      "instagramInvalid",
    ),
    website: optionalChecked(MAX_CAFE_URL_LENGTH, isWebAddress, "urlInvalid"),
    latitude: coordinateField(90),
    longitude: coordinateField(180),
  })
  .check(
    z.refine((value) => (value.latitude === undefined) === (value.longitude === undefined), {
      path: ["longitude"],
      error: "coordinatesBoth",
      when: fieldsParsed("latitude", "longitude"),
    }),
  );

export type CafeProfileFormInput = z.input<typeof cafeProfileSchema>;
export type CafeProfileValues = z.output<typeof cafeProfileSchema>;

/** One day's hours: closed, or an opening and a closing time (a close before the open runs past midnight). */
const dayHoursObject = {
  closed: z.boolean(),
  opens: z.string().check(z.trim()),
  closes: z.string().check(z.trim()),
};

type DayHoursShape = { closed: boolean; opens: string; closes: string };

function checkHours(value: DayHoursShape, ctx: z.core.$RefinementCtx<DayHoursShape>): void {
  if (value.closed) return;
  if (!isClockTime(value.opens)) ctx.addIssue({ code: "custom", path: ["opens"], message: "timeInvalid" });
  if (!isClockTime(value.closes)) ctx.addIssue({ code: "custom", path: ["closes"], message: "timeInvalid" });
  else if (value.opens === value.closes) {
    ctx.addIssue({ code: "custom", path: ["closes"], message: "closesSameAsOpens" });
  }
}

const dayHoursSchema = z.object(dayHoursObject).check(z.superRefine(checkHours));

const exceptionSchema = z
  .object({
    date: dayField,
    ...dayHoursObject,
    note: optionalTextField(MAX_HOURS_NOTE_LENGTH),
    noteFa: optionalTextField(MAX_HOURS_NOTE_LENGTH),
  })
  .check(z.superRefine(checkHours, { when: fieldsParsed("date", "note", "noteFa") }));

/** The week's hours, Saturday first, and the special days that differ (no day twice). */
export const openingHoursSchema = z
  .object({
    weekly: z.nullable(
      z.object(
        Object.fromEntries(WEEKDAYS.map((day) => [day, dayHoursSchema])) as Record<Weekday, typeof dayHoursSchema>,
      ),
    ),
    exceptions: z.array(exceptionSchema).check(z.maxLength(MAX_HOURS_EXCEPTIONS, "exceptionsTooMany")),
  })
  .check(
    z.superRefine(
      (value, ctx) => {
        const seen = new Set<string>();
        value.exceptions.forEach((exception, index) => {
          if (seen.has(exception.date)) {
            ctx.addIssue({ code: "custom", path: ["exceptions", index, "date"], message: "exceptionDuplicate" });
          }
          seen.add(exception.date);
        });
      },
      { when: fieldsParsed("exceptions.*.note", "exceptions.*.noteFa") },
    ),
  );

export type OpeningHoursFormInput = z.input<typeof openingHoursSchema>;
export type OpeningHoursValues = z.output<typeof openingHoursSchema>;

function receiptField(maxLines?: number) {
  return z.pipe(
    z.string().check(
      z.trim(),
      z.maxLength(MAX_RECEIPT_TEXT_LENGTH, "textTooLong"),
      z.refine((value) => maxLines === undefined || value.split(/\r?\n/).length <= maxLines, "receiptLinesTooMany"),
    ),
    z.transform((value) => (value.length > 0 ? value : undefined)),
  );
}

/** The lines printed at the top of every receipt (a few) and the note at its foot, in both languages. */
export const receiptSettingsSchema = z.object({
  header: receiptField(MAX_RECEIPT_HEADER_LINES),
  headerFa: receiptField(MAX_RECEIPT_HEADER_LINES),
  footer: receiptField(),
  footerFa: receiptField(),
});

export type ReceiptSettingsFormInput = z.input<typeof receiptSettingsSchema>;
export type ReceiptSettingsValues = z.output<typeof receiptSettingsSchema>;
