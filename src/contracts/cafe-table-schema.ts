import {
  MAX_CAFE_TABLES,
  MAX_CAFE_TABLE_LABEL_LENGTH,
  MAX_TABLE_AREA_LENGTH,
  isTableSeats,
} from "@/src/domain/entities/CafeTable";
import * as z from "@/src/lib/zod";

import { optionalTextField } from "./money-fields";

/**
 * A floor table named on a booking or an event hold. Which labels are on the
 * floor is the cafe's own list (settings), so the form can only check the shape;
 * the use-case checks the label is a table in use.
 */
export const floorTableLabelField = z
  .string()
  .check(z.trim(), z.minLength(1, "tableInvalid"), z.maxLength(MAX_CAFE_TABLE_LABEL_LENGTH, "tableInvalid"));

/** A set of floor tables (an event's hold); empty releases them all. */
export const floorTableLabelsField = z.array(floorTableLabelField).check(z.maxLength(MAX_CAFE_TABLES, "tableInvalid"));

/** A table as the settings dialog fills it in: label, seats, where it stands, and whether it's in use. */
export const cafeTableSchema = z.object({
  label: z
    .string()
    .check(z.trim(), z.minLength(1, "labelRequired"), z.maxLength(MAX_CAFE_TABLE_LABEL_LENGTH, "labelTooLong")),
  seats: z
    .pipe(z.string().check(z.trim(), z.regex(/^\d+$/, "tableSeatsInvalid")), z.transform(Number))
    .check(z.refine(isTableSeats, "tableSeatsInvalid")),
  area: z.optional(optionalTextField(MAX_TABLE_AREA_LENGTH)),
  isActive: z.boolean(),
});

export type CafeTableFormInput = z.input<typeof cafeTableSchema>;
export type CafeTableValues = z.output<typeof cafeTableSchema>;

/** Moving a table one place along the floor order. */
export const cafeTableMoveSchema = z.object({
  direction: z.enum(["up", "down"], { error: "statusInvalid" }),
});
