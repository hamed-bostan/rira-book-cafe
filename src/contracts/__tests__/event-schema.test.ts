import { describe, expect, it } from "vitest";

import { eventFormSchema, eventTablesSchema, type EventFormInput } from "../event-schema";
import { requestReservationSchema, reservationUpdateSchema } from "../reservation-schema";

const FORM: EventFormInput = {
  kind: "reading",
  title: "An evening with the author",
  description: "",
  titleFa: "",
  descriptionFa: "",
  imageUrl: "",
  startsAt: "2026-10-25T19:00",
  endsAt: "2026-10-25T21:00",
  capacity: "",
  price: "",
  isPublished: false,
};

describe("eventFormSchema", () => {
  it("converts cafe wall time to UTC and blanks to defaults", () => {
    const parsed = eventFormSchema.parse(FORM);
    expect(parsed.startsAt).toBe("2026-10-25T15:30:00.000Z");
    expect(parsed).toMatchObject({ capacity: undefined, price: 0, imageUrl: undefined, description: undefined });
  });

  it("refuses an end before the start", () => {
    const result = eventFormSchema.safeParse({ ...FORM, endsAt: "2026-10-25T18:00" });
    expect(result.error?.issues.map((issue) => issue.message)).toContain("endBeforeStart");
  });
});

describe("eventTablesSchema", () => {
  it("accepts floor tables, and none to release them all", () => {
    expect(eventTablesSchema.parse({ tableLabels: ["7", "long"] })).toEqual({ tableLabels: ["7", "long"] });
    expect(eventTablesSchema.parse({ tableLabels: [] })).toEqual({ tableLabels: [] });
  });

  it("refuses a table that isn't on the floor plan", () => {
    const result = eventTablesSchema.safeParse({ tableLabels: ["Table 7"] });
    expect(result.error?.issues.map((issue) => issue.message)).toContain("tableInvalid");
  });
});

describe("reservation contracts", () => {
  it("accepts a datetime-local value and a party size", () => {
    expect(requestReservationSchema.safeParse({ startsAt: "2026-10-21T19:30", partySize: 4 }).success).toBe(true);
    expect(requestReservationSchema.safeParse({ startsAt: "tomorrow", partySize: 4 }).success).toBe(false);
  });

  it("needs a status or a table to change", () => {
    expect(reservationUpdateSchema.safeParse({}).success).toBe(false);
    expect(reservationUpdateSchema.safeParse({ tableLabel: null }).success).toBe(true);
  });
});
