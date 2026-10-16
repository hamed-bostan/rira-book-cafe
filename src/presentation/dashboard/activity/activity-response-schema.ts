import { z } from "zod";

import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ENTITY_TYPES,
  type ActivityEntry,
} from "@/src/domain/entities/ActivityEntry";

/**
 * What the activity endpoints promise, as the client receives it.
 *
 * `at` is a string here, not a `Date`: JSON has no date type, so the entity's
 * `Date` crosses the wire as an ISO string and the screens format it from there
 * (`formatRelativeTime` takes either). Same treatment the role-change history had.
 */
export type ActivityEntryWire = Omit<ActivityEntry, "at"> & { at: string };

const activityChangeSchema = z.object({
  field: z.string(),
  before: z.string().nullable(),
  after: z.string().nullable(),
});

/**
 * The action and entity type are validated against the domain's own unions rather
 * than accepted as free strings, so a typo on the server surfaces here as a parse
 * failure instead of an entry that renders as a missing translation.
 *
 * `unknown` is included on both because it's a real value the adapter produces for
 * a row this build doesn't recognise — the client has to be able to receive one.
 */
export const activityEntryResponseSchema = z.object({
  id: z.string(),
  actorId: z.string(),
  actorName: z.string(),
  action: z.enum([...ACTIVITY_ACTIONS, "unknown"]),
  entityType: z.enum([...ACTIVITY_ENTITY_TYPES, "unknown"]),
  entityId: z.string(),
  entityLabel: z.string().optional(),
  changes: z.array(activityChangeSchema),
  at: z.string(),
}) satisfies z.ZodType<ActivityEntryWire>;

export const activityEntryListResponseSchema = z.array(activityEntryResponseSchema);

/** One option in the actor filter. */
export const activityActorResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const activityActorListResponseSchema = z.array(activityActorResponseSchema);

export type ActivityActorWire = z.infer<typeof activityActorResponseSchema>;
