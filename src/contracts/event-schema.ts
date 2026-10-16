import { z } from "zod";

import {
  EVENT_KINDS,
  MAX_EVENT_DESCRIPTION_LENGTH,
  MAX_EVENT_TITLE_LENGTH,
  MAX_SEATS_PER_REGISTRATION,
} from "@/src/domain/entities/CafeEvent";
import { isWallTime, wallTimeToDate } from "@/src/domain/entities/CafeTime";

/**
 * Event contracts shared by the admin form, the guest sign-up and the route
 * handlers. The form authors strings (what its controls emit); the schema's
 * output is the domain shape `NewCafeEvent` with UTC ISO times. Messages are
 * `formErrors` keys.
 */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "descriptionTooLong")
    .transform((value) => (value.length > 0 ? value : undefined));

const wallTime = z.string().refine(isWallTime, "dateTimeInvalid");

export const eventFormSchema = z
  .object({
    kind: z.enum(EVENT_KINDS, { message: "kindInvalid" }),
    title: z.string().trim().min(1, "titleRequired").max(MAX_EVENT_TITLE_LENGTH, "titleTooLong"),
    description: optionalText(MAX_EVENT_DESCRIPTION_LENGTH),
    titleFa: optionalText(MAX_EVENT_TITLE_LENGTH),
    descriptionFa: optionalText(MAX_EVENT_DESCRIPTION_LENGTH),
    imageUrl: z
      .string()
      .trim()
      .transform((value) => (value.length > 0 ? value : undefined))
      .refine((value) => value === undefined || z.string().url().safeParse(value).success, "imageInvalid"),
    /** Cafe wall time, `YYYY-MM-DDTHH:mm`. */
    startsAt: wallTime,
    endsAt: wallTime,
    /** Blank means no seat limit. */
    capacity: z
      .string()
      .trim()
      .refine((value) => value === "" || /^\d+$/.test(value), "capacityWhole")
      .transform((value) => (value === "" ? undefined : Number(value)))
      .refine((value) => value === undefined || value >= 1, "capacityMin"),
    /** Toman; blank or 0 is free. */
    price: z
      .string()
      .trim()
      .refine((value) => value === "" || /^\d+$/.test(value), "priceInvalid")
      .transform((value) => (value === "" ? 0 : Number(value))),
    isPublished: z.boolean(),
  })
  .refine((data) => !isWallTime(data.startsAt) || !isWallTime(data.endsAt) || data.endsAt > data.startsAt, {
    path: ["endsAt"],
    message: "endBeforeStart",
  })
  .transform(({ startsAt, endsAt, ...rest }) => ({
    ...rest,
    startsAt: wallTimeToDate(startsAt).toISOString(),
    endsAt: wallTimeToDate(endsAt).toISOString(),
  }));

export type EventFormInput = z.input<typeof eventFormSchema>;
export type EventFormValues = z.output<typeof eventFormSchema>;

/** A guest signing up. */
export const eventRegistrationSchema = z.object({
  seats: z.number().int("seatsInvalid").min(1, "seatsInvalid").max(MAX_SEATS_PER_REGISTRATION, "seatsInvalid"),
});

export type EventRegistrationInput = z.infer<typeof eventRegistrationSchema>;
