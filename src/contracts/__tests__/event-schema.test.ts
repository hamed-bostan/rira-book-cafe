import { describe, expect, it } from "vitest";

import { MAX_EVENT_CAPACITY } from "@/src/domain/entities/CafeEvent";
import { MAX_ORDER_AMOUNT } from "@/src/domain/entities/Order";

import { eventFormSchema, eventTablesSchema, type EventFormInput } from "../event-schema";
import { requestReservationSchema, reservationUpdateSchema } from "../reservation-schema";

import { messagesAt } from "./zod-issues";

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

  it("caps the capacity", () => {
    expect(eventFormSchema.parse({ ...FORM, capacity: String(MAX_EVENT_CAPACITY) }).capacity).toBe(MAX_EVENT_CAPACITY);
    const result = eventFormSchema.safeParse({ ...FORM, capacity: String(MAX_EVENT_CAPACITY + 1) });
    expect(messagesAt(result, "capacity")).toEqual(["capacityTooLarge"]);
  });

  it("caps the price at what an order can hold", () => {
    expect(eventFormSchema.parse({ ...FORM, price: String(MAX_ORDER_AMOUNT) }).price).toBe(MAX_ORDER_AMOUNT);
    const result = eventFormSchema.safeParse({ ...FORM, price: String(MAX_ORDER_AMOUNT + 1) });
    expect(messagesAt(result, "price")).toEqual(["amountTooLarge"]);
  });
});

describe("eventTablesSchema", () => {
  it("accepts floor tables, and none to release them all", () => {
    expect(eventTablesSchema.parse({ tableLabels: ["7", "long"] })).toEqual({ tableLabels: ["7", "long"] });
    expect(eventTablesSchema.parse({ tableLabels: [] })).toEqual({ tableLabels: [] });
  });

  it("refuses a blank or overlong label; which labels are on the floor is the use-case's check", () => {
    for (const label of ["", "   ", "x".repeat(21)]) {
      const result = eventTablesSchema.safeParse({ tableLabels: [label] });
      expect(result.error?.issues.map((issue) => issue.message)).toContain("tableInvalid");
    }
    expect(eventTablesSchema.parse({ tableLabels: [" Window "] })).toEqual({ tableLabels: ["Window"] });
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
