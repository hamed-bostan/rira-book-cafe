import { z } from "zod/mini";

import { WEEKDAYS, type CafeSettings, type Weekday } from "@/src/domain/entities/CafeSettings";

const dayHours = z.object({ closed: z.boolean(), opens: z.optional(z.string()), closes: z.optional(z.string()) });

/** What `GET /api/settings` (and every settings write) returns, validated at the typed-service boundary. */
export const cafeSettingsResponseSchema = z.object({
  profile: z.object({
    name: z.optional(z.string()),
    nameFa: z.optional(z.string()),
    address: z.optional(z.string()),
    addressFa: z.optional(z.string()),
    phone: z.optional(z.string()),
    instagram: z.optional(z.string()),
    website: z.optional(z.string()),
    latitude: z.optional(z.number()),
    longitude: z.optional(z.number()),
  }),
  hours: z.object({
    weekly: z.nullable(
      z.object(Object.fromEntries(WEEKDAYS.map((day) => [day, dayHours])) as Record<Weekday, typeof dayHours>),
    ),
    exceptions: z.array(
      z.object({
        date: z.string(),
        closed: z.boolean(),
        opens: z.optional(z.string()),
        closes: z.optional(z.string()),
        note: z.optional(z.string()),
        noteFa: z.optional(z.string()),
      }),
    ),
  }),
  receipt: z.object({
    header: z.optional(z.string()),
    headerFa: z.optional(z.string()),
    footer: z.optional(z.string()),
    footerFa: z.optional(z.string()),
  }),
}) satisfies z.ZodMiniType<CafeSettings>;
