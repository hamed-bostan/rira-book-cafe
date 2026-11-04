import { describe, expect, it } from "vitest";

import { WEEKDAYS } from "@/src/domain/entities/CafeSettings";

import { cafeProfileSchema, openingHoursSchema, receiptSettingsSchema } from "../cafe-settings-schema";
import { cafeTableSchema } from "../cafe-table-schema";

const PROFILE = {
  name: "",
  nameFa: "",
  address: "",
  addressFa: "",
  phone: "",
  instagram: "",
  website: "",
  latitude: "",
  longitude: "",
};

const OPEN_DAY = { closed: false, opens: "08:00", closes: "22:00" };
const WEEK = Object.fromEntries(WEEKDAYS.map((day) => [day, OPEN_DAY]));

function messages(result: { error?: { issues: { path: PropertyKey[]; message: string }[] } }, path: string) {
  return result.error?.issues.filter((issue) => issue.path.join(".") === path).map((issue) => issue.message) ?? [];
}

describe("cafeProfileSchema", () => {
  it("turns blanks into nothing and coordinates into numbers", () => {
    expect(cafeProfileSchema.parse({ ...PROFILE, name: " Rira ", latitude: "35.7", longitude: "51.4" })).toEqual({
      name: "Rira",
      latitude: 35.7,
      longitude: 51.4,
    });
  });

  it("names what's wrong with each field", () => {
    const result = cafeProfileSchema.safeParse({
      ...PROFILE,
      phone: "call us",
      instagram: "not a handle!",
      website: "rira.example",
      latitude: "north",
    });
    expect(messages(result, "phone")).toEqual(["phoneInvalid"]);
    expect(messages(result, "instagram")).toEqual(["instagramInvalid"]);
    expect(messages(result, "website")).toEqual(["urlInvalid"]);
    expect(messages(result, "latitude")).toEqual(["coordinateInvalid"]);
  });

  it("accepts a pasted Instagram address, and wants both coordinates or neither", () => {
    expect(cafeProfileSchema.safeParse({ ...PROFILE, instagram: "https://instagram.com/rira.cafe" }).success).toBe(
      true,
    );
    const half = cafeProfileSchema.safeParse({ ...PROFILE, latitude: "35.7" });
    expect(messages(half, "longitude")).toEqual(["coordinatesBoth"]);
  });
});

describe("openingHoursSchema", () => {
  it("accepts the week and special days, closed days with blank times", () => {
    const result = openingHoursSchema.safeParse({
      weekly: { ...WEEK, Friday: { closed: true, opens: "", closes: "" } },
      exceptions: [{ date: "2027-03-21", closed: true, opens: "", closes: "", note: "Nowruz", noteFa: "" }],
    });
    expect(result.success).toBe(true);
    expect(result.data?.exceptions[0]).toMatchObject({ note: "Nowruz", noteFa: undefined });
  });

  it("wants both times on an open day, and different ones", () => {
    const result = openingHoursSchema.safeParse({
      weekly: {
        ...WEEK,
        Monday: { closed: false, opens: "", closes: "08:00" },
        Tuesday: { ...OPEN_DAY, closes: "08:00" },
      },
      exceptions: [],
    });
    expect(messages(result, "weekly.Monday.opens")).toEqual(["timeInvalid"]);
    expect(messages(result, "weekly.Tuesday.closes")).toEqual(["closesSameAsOpens"]);
  });

  it("refuses the same special day twice", () => {
    const day = { date: "2027-03-21", closed: true, opens: "", closes: "", note: "", noteFa: "" };
    const result = openingHoursSchema.safeParse({ weekly: WEEK, exceptions: [day, day] });
    expect(messages(result, "exceptions.1.date")).toEqual(["exceptionDuplicate"]);
  });
});

describe("receiptSettingsSchema", () => {
  it("keeps the header to four lines", () => {
    const base = { header: "", headerFa: "", footer: "", footerFa: "" };
    expect(receiptSettingsSchema.parse({ ...base, header: "Rira\nTax no. 1" })).toMatchObject({
      header: "Rira\nTax no. 1",
    });
    expect(messages(receiptSettingsSchema.safeParse({ ...base, headerFa: "1\n2\n3\n4\n5" }), "headerFa")).toEqual([
      "receiptLinesTooMany",
    ]);
    // The note at the foot has no line limit, only a length.
    expect(receiptSettingsSchema.safeParse({ ...base, footer: "1\n2\n3\n4\n5" }).success).toBe(true);
  });
});

describe("cafeTableSchema", () => {
  it("reads seats as a number and needs a label", () => {
    expect(cafeTableSchema.parse({ label: " 9 ", seats: "4", area: "", isActive: true })).toEqual({
      label: "9",
      seats: 4,
      area: undefined,
      isActive: true,
    });
    const result = cafeTableSchema.safeParse({ label: "", seats: "0", area: "", isActive: true });
    expect(messages(result, "label")).toEqual(["labelRequired"]);
    expect(messages(result, "seats")).toEqual(["tableSeatsInvalid"]);
  });
});
