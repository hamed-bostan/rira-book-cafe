import { describe, expect, it, vi } from "vitest";

import {
  EMPTY_CAFE_SETTINGS,
  WEEKDAYS,
  type CafeSettings,
  type OpeningHours,
  type WeeklyHours,
} from "../../../entities/CafeSettings";
import { ValidationError } from "../../../errors/ValidationError";
import {
  UpdateCafeProfile,
  UpdateOpeningHours,
  UpdateReceiptSettings,
  normalizeHours,
  normalizeProfile,
  normalizeReceipt,
} from "../CafeSettingsCommands";

import type { NewActivityEntry } from "../../../entities/ActivityEntry";
import type { ICafeSettingsRepository } from "../../../repositories/ICafeSettingsRepository";

const ACTOR = { id: "a1", name: "Admin" };

const WEEK = Object.fromEntries(
  WEEKDAYS.map((day) => [
    day,
    day === "Friday" ? { closed: true } : { closed: false, opens: "08:00", closes: "22:00" },
  ]),
) as WeeklyHours;

/** A settings store holding `current`; every write lands on it and runs the audit hook. */
function store(current: CafeSettings = EMPTY_CAFE_SETTINGS) {
  let settings = current;
  const entries: NewActivityEntry[] = [];
  const write =
    (section: keyof CafeSettings) =>
    async (value: unknown, audit?: (saved: CafeSettings) => NewActivityEntry | null): Promise<CafeSettings> => {
      settings = { ...settings, [section]: value };
      const entry = audit?.(settings);
      if (entry) entries.push(entry);
      return settings;
    };
  const repo = {
    get: vi.fn(async () => settings),
    updateProfile: vi.fn(write("profile")),
    updateHours: vi.fn(write("hours")),
    updateReceipt: vi.fn(write("receipt")),
  } satisfies ICafeSettingsRepository;
  return { repo, entries };
}

describe("normalizeProfile", () => {
  it("trims, drops blanks and reads an Instagram username from a pasted address", () => {
    expect(
      normalizeProfile({
        name: "  Rira  ",
        nameFa: " ",
        instagram: "https://instagram.com/rira.cafe",
        website: "https://rira.example",
        phone: "+98 21 1234 5678",
        latitude: 35.7,
        longitude: 51.4,
      }),
    ).toEqual({
      name: "Rira",
      instagram: "rira.cafe",
      website: "https://rira.example",
      phone: "+98 21 1234 5678",
      latitude: 35.7,
      longitude: 51.4,
    });
  });

  it("refuses a bad link, phone or map position", () => {
    expect(() => normalizeProfile({ website: "rira" })).toThrow(ValidationError);
    expect(() => normalizeProfile({ website: "ftp://rira.example" })).toThrow(ValidationError);
    expect(() => normalizeProfile({ instagram: "not a handle!" })).toThrow(ValidationError);
    expect(() => normalizeProfile({ phone: "call us" })).toThrow(ValidationError);
    expect(() => normalizeProfile({ latitude: 35.7 })).toThrow(ValidationError);
    expect(() => normalizeProfile({ latitude: 95, longitude: 51 })).toThrow(ValidationError);
    expect(() => normalizeProfile({ name: "x".repeat(81) })).toThrow(ValidationError);
  });
});

describe("normalizeHours", () => {
  it("keeps a closed day without times and sorts the special days", () => {
    const result = normalizeHours({
      weekly: { ...WEEK, Friday: { closed: true, opens: "08:00", closes: "12:00" } },
      exceptions: [
        { date: "2027-03-22", closed: false, opens: "12:00", closes: "18:00", note: " Nowruz " },
        { date: "2027-03-21", closed: true },
      ],
    });
    expect(result.weekly?.Friday).toEqual({ closed: true });
    expect(result.exceptions).toEqual([
      { date: "2027-03-21", closed: true },
      { date: "2027-03-22", closed: false, opens: "12:00", closes: "18:00", note: "Nowruz" },
    ]);
  });

  it("refuses a missing or equal time, a missing day, and a day listed twice", () => {
    const at =
      (weekly: WeeklyHours, exceptions: OpeningHours["exceptions"] = []) =>
      () =>
        normalizeHours({ weekly, exceptions });
    expect(at({ ...WEEK, Monday: { closed: false, opens: "08:00" } })).toThrow(ValidationError);
    expect(at({ ...WEEK, Monday: { closed: false, opens: "08:00", closes: "08:00" } })).toThrow(ValidationError);
    const { Monday: _monday, ...noMonday } = WEEK;
    expect(at(noMonday as WeeklyHours)).toThrow(ValidationError);
    expect(
      at(WEEK, [
        { date: "2027-03-21", closed: true },
        { date: "2027-03-21", closed: true },
      ]),
    ).toThrow(ValidationError);
    expect(at(WEEK, [{ date: "21/03/2027", closed: true }])).toThrow(ValidationError);
  });
});

describe("normalizeReceipt", () => {
  it("trims each line, and caps the header's lines", () => {
    expect(normalizeReceipt({ header: "  Rira  \n  Tax no. 123 ", footer: " " })).toEqual({
      header: "Rira\nTax no. 123",
    });
    expect(() => normalizeReceipt({ header: "1\n2\n3\n4\n5" })).toThrow(ValidationError);
    expect(() => normalizeReceipt({ footer: "x".repeat(301) })).toThrow(ValidationError);
  });
});

describe("UpdateCafeProfile", () => {
  it("saves the profile and logs the fields that moved", async () => {
    const { repo, entries } = store({ ...EMPTY_CAFE_SETTINGS, profile: { name: "Rira", phone: "021 1234" } });

    const saved = await new UpdateCafeProfile(repo).execute({ name: "Rira", phone: "021 5678", website: "" }, ACTOR);

    expect(saved.profile).toEqual({ name: "Rira", phone: "021 5678" });
    expect(entries).toEqual([
      expect.objectContaining({
        action: "settings.profileChanged",
        entityType: "settings",
        entityId: "cafe",
        changes: [{ field: "phone", before: "021 1234", after: "021 5678" }],
      }),
    ]);
  });

  it("logs nothing for a save that changed nothing", async () => {
    const { repo, entries } = store({ ...EMPTY_CAFE_SETTINGS, profile: { name: "Rira" } });
    await new UpdateCafeProfile(repo).execute({ name: " Rira " }, ACTOR);
    expect(entries).toEqual([]);
  });
});

describe("UpdateOpeningHours", () => {
  it("logs each weekday that changed and the special days", async () => {
    const { repo, entries } = store({ ...EMPTY_CAFE_SETTINGS, hours: { weekly: WEEK, exceptions: [] } });

    await new UpdateOpeningHours(repo).execute(
      {
        weekly: { ...WEEK, Friday: { closed: false, opens: "16:00", closes: "23:00" } },
        exceptions: [{ date: "2027-03-21", closed: true }],
      },
      ACTOR,
    );

    expect(entries[0]).toMatchObject({ action: "settings.hoursChanged" });
    expect(entries[0].changes).toEqual([
      { field: "friday", before: "closed", after: "16:00–23:00" },
      { field: "specialDays", before: null, after: "2027-03-21 closed" },
    ]);
  });

  it("logs every day the first time the week is set", async () => {
    const { repo, entries } = store();
    await new UpdateOpeningHours(repo).execute({ weekly: WEEK, exceptions: [] }, ACTOR);
    expect(entries[0].changes.map((change) => change.field)).toEqual(WEEKDAYS.map((day) => day.toLowerCase()));
  });
});

describe("UpdateReceiptSettings", () => {
  it("saves the receipt copy and logs it", async () => {
    const { repo, entries } = store();

    const saved = await new UpdateReceiptSettings(repo).execute(
      { headerFa: "کافه کتاب ریرا", footer: "Thanks!" },
      ACTOR,
    );

    expect(saved.receipt).toEqual({ headerFa: "کافه کتاب ریرا", footer: "Thanks!" });
    expect(entries[0]).toMatchObject({ action: "settings.receiptChanged" });
    expect(entries[0].changes.map((change) => change.field)).toEqual(["receiptHeaderFa", "receiptFooter"]);
  });
});
