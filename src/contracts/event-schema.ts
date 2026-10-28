import {
  EVENT_KINDS,
  MAX_EVENT_DESCRIPTION_LENGTH,
  MAX_EVENT_TITLE_LENGTH,
  MAX_SEATS_PER_REGISTRATION,
} from "@/src/domain/entities/CafeEvent";
import { CAFE_TABLE_LABELS } from "@/src/domain/entities/CafeTable";
import { isWallTime, wallTimeToDate } from "@/src/domain/entities/CafeTime";
import * as z from "@/src/lib/zod";

import { fieldsParsed } from "./fields-parsed";
import { isImageUrl } from "./image-url";

/**
 * Event contracts shared by the admin form, the guest sign-up and the route
 * handlers. The form authors strings (what its controls emit); the schema's
 * output is the domain shape `NewCafeEvent` with UTC ISO times. Messages are
 * `formErrors` keys.
 */

const optionalText = (max: number) =>
  z.pipe(
    z.string().check(z.trim(), z.maxLength(max, "descriptionTooLong")),
    z.transform((value) => (value.length > 0 ? value : undefined)),
  );

const wallTime = z.string().check(z.refine(isWallTime, "dateTimeInvalid"));

export const eventFormSchema = z.pipe(
  z
    .object({
      kind: z.enum(EVENT_KINDS, { error: "kindInvalid" }),
      title: z
        .string()
        .check(z.trim(), z.minLength(1, "titleRequired"), z.maxLength(MAX_EVENT_TITLE_LENGTH, "titleTooLong")),
      description: optionalText(MAX_EVENT_DESCRIPTION_LENGTH),
      titleFa: optionalText(MAX_EVENT_TITLE_LENGTH),
      descriptionFa: optionalText(MAX_EVENT_DESCRIPTION_LENGTH),
      imageUrl: z
        .pipe(
          z.string().check(z.trim()),
          z.transform((value) => (value.length > 0 ? value : undefined)),
        )
        .check(z.refine((value) => value === undefined || isImageUrl(value), "imageInvalid")),
      /** Cafe wall time, `YYYY-MM-DDTHH:mm`. */
      startsAt: wallTime,
      endsAt: wallTime,
      /** Blank means no seat limit. */
      capacity: z
        .pipe(
          z.string().check(
            z.trim(),
            z.refine((value) => value === "" || /^\d+$/.test(value), "capacityWhole"),
          ),
          z.transform((value) => (value === "" ? undefined : Number(value))),
        )
        .check(z.refine((value) => value === undefined || value >= 1, "capacityMin")),
      /** Toman; blank or 0 is free. */
      price: z.pipe(
        z.string().check(
          z.trim(),
          z.refine((value) => value === "" || /^\d+$/.test(value), "priceInvalid"),
        ),
        z.transform((value) => (value === "" ? 0 : Number(value))),
      ),
      isPublished: z.boolean(),
    })
    .check(
      z.refine((data) => !isWallTime(data.startsAt) || !isWallTime(data.endsAt) || data.endsAt > data.startsAt, {
        path: ["endsAt"],
        error: "endBeforeStart",
        when: fieldsParsed("description", "titleFa", "descriptionFa", "capacity", "price"),
      }),
    ),
  z.transform(({ startsAt, endsAt, ...rest }) => ({
    ...rest,
    startsAt: wallTimeToDate(startsAt).toISOString(),
    endsAt: wallTimeToDate(endsAt).toISOString(),
  })),
);

export type EventFormInput = z.input<typeof eventFormSchema>;
export type EventFormValues = z.output<typeof eventFormSchema>;

/** Staff choosing the tables an event holds; an empty list releases them all. */
export const eventTablesSchema = z.object({
  tableLabels: z
    .array(z.enum(CAFE_TABLE_LABELS, { error: "tableInvalid" }))
    .check(z.maxLength(CAFE_TABLE_LABELS.length, "tableInvalid")),
});

export type EventTablesInput = z.infer<typeof eventTablesSchema>;

/** A guest signing up. */
export const eventRegistrationSchema = z.object({
  seats: z
    .number()
    .check(z.int("seatsInvalid"), z.gte(1, "seatsInvalid"), z.lte(MAX_SEATS_PER_REGISTRATION, "seatsInvalid")),
});

export type EventRegistrationInput = z.infer<typeof eventRegistrationSchema>;
