import { diffFields, type ActivityActor, type ActivityChange } from "../../entities/ActivityEntry";
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
  dayHoursValue,
  instagramHandle,
  isClockTime,
  type CafeProfile,
  type CafeSettings,
  type DayHours,
  type HoursException,
  type OpeningHours,
  type ReceiptSettings,
  type WeeklyHours,
} from "../../entities/CafeSettings";
import { isCafeDay } from "../../entities/CafeTime";
import { ValidationError } from "../../errors/ValidationError";

import type { ICafeSettingsRepository } from "../../repositories/ICafeSettingsRepository";

/** Instagram usernames: letters, digits, dots and underscores. */
const INSTAGRAM_HANDLE = /^[A-Za-z0-9._]{1,30}$/;
/** Digits, spaces, dashes, brackets and a leading plus — a phone as people write it. */
const PHONE = /^\+?[0-9][0-9 ()-]{3,}$/;

/** The entity id every settings entry is filed under — there's one cafe. */
export const CAFE_SETTINGS_ENTITY_ID = "cafe";

function text(field: string, value: string | undefined, max: number): string | undefined {
  const trimmed = value?.trim() || undefined;
  if (trimmed && trimmed.length > max) throw new ValidationError(field, "That's too long.");
  return trimmed;
}

/** The profile as it will be stored: trimmed, blanks dropped, every rule re-checked. */
export function normalizeProfile(profile: CafeProfile): CafeProfile {
  const pasted = text("instagram", profile.instagram, MAX_CAFE_URL_LENGTH);
  const instagram = pasted ? instagramHandle(pasted) : undefined;
  if (instagram && !INSTAGRAM_HANDLE.test(instagram)) {
    throw new ValidationError("instagram", "Enter an Instagram username.");
  }
  const website = text("website", profile.website, MAX_CAFE_URL_LENGTH);
  if (website && !isWebAddress(website)) throw new ValidationError("website", "Enter a web address.");
  const phone = text("phone", profile.phone, MAX_CAFE_PHONE_LENGTH);
  if (phone && !PHONE.test(phone)) throw new ValidationError("phone", "Enter a phone number.");

  const { latitude, longitude } = profile;
  if ((latitude === undefined) !== (longitude === undefined)) {
    throw new ValidationError(latitude === undefined ? "latitude" : "longitude", "Enter both coordinates.");
  }
  if (latitude !== undefined && (!Number.isFinite(latitude) || Math.abs(latitude) > 90)) {
    throw new ValidationError("latitude", "Latitude is between -90 and 90.");
  }
  if (longitude !== undefined && (!Number.isFinite(longitude) || Math.abs(longitude) > 180)) {
    throw new ValidationError("longitude", "Longitude is between -180 and 180.");
  }

  return dropUndefined({
    name: text("name", profile.name, MAX_CAFE_NAME_LENGTH),
    nameFa: text("nameFa", profile.nameFa, MAX_CAFE_NAME_LENGTH),
    address: text("address", profile.address, MAX_CAFE_ADDRESS_LENGTH),
    addressFa: text("addressFa", profile.addressFa, MAX_CAFE_ADDRESS_LENGTH),
    phone,
    instagram,
    website,
    latitude,
    longitude,
  });
}

function isWebAddress(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname.includes(".");
  } catch {
    return false;
  }
}

function checkDay(field: string, hours: DayHours): DayHours {
  if (hours.closed) return { closed: true };
  if (!hours.opens || !isClockTime(hours.opens)) throw new ValidationError(`${field}.opens`, "Enter when it opens.");
  if (!hours.closes || !isClockTime(hours.closes)) {
    throw new ValidationError(`${field}.closes`, "Enter when it closes.");
  }
  if (hours.opens === hours.closes) {
    throw new ValidationError(`${field}.closes`, "Closing time must differ from opening time.");
  }
  return { closed: false, opens: hours.opens, closes: hours.closes };
}

/** The hours as they will be stored: every open day with valid times, exceptions on distinct days in date order. */
export function normalizeHours(hours: OpeningHours): OpeningHours {
  let weekly: WeeklyHours | null = null;
  if (hours.weekly) {
    const days = hours.weekly;
    weekly = Object.fromEntries(
      WEEKDAYS.map((day) => {
        if (!days[day]) throw new ValidationError(`weekly.${day}`, "Set every day of the week.");
        return [day, checkDay(`weekly.${day}`, days[day])];
      }),
    ) as WeeklyHours;
  }

  if (hours.exceptions.length > MAX_HOURS_EXCEPTIONS) {
    throw new ValidationError("exceptions", `Up to ${MAX_HOURS_EXCEPTIONS} special days.`);
  }
  const seen = new Set<string>();
  const exceptions = hours.exceptions.map((exception, index): HoursException => {
    const field = `exceptions.${index}`;
    if (!isCafeDay(exception.date)) throw new ValidationError(`${field}.date`, "Choose a date.");
    if (seen.has(exception.date)) throw new ValidationError(`${field}.date`, "That day is listed twice.");
    seen.add(exception.date);
    return dropUndefined({
      date: exception.date,
      ...checkDay(field, exception),
      note: text(`${field}.note`, exception.note, MAX_HOURS_NOTE_LENGTH),
      noteFa: text(`${field}.noteFa`, exception.noteFa, MAX_HOURS_NOTE_LENGTH),
    });
  });
  exceptions.sort((a, b) => a.date.localeCompare(b.date));

  return { weekly, exceptions };
}

function receiptText(field: string, value: string | undefined, maxLines?: number): string | undefined {
  // Line breaks are kept; spaces at either end of each line aren't.
  const lines = (value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .join("\n")
    .trim();
  if (lines.length > MAX_RECEIPT_TEXT_LENGTH) throw new ValidationError(field, "That's too long.");
  if (maxLines !== undefined && lines.split("\n").length > maxLines) {
    throw new ValidationError(field, `Up to ${maxLines} lines.`);
  }
  return lines || undefined;
}

/** The receipt copy as it will be stored: trimmed per line, blanks dropped. */
export function normalizeReceipt(receipt: ReceiptSettings): ReceiptSettings {
  return dropUndefined({
    header: receiptText("header", receipt.header, MAX_RECEIPT_HEADER_LINES),
    headerFa: receiptText("headerFa", receipt.headerFa, MAX_RECEIPT_HEADER_LINES),
    footer: receiptText("footer", receipt.footer),
    footerFa: receiptText("footerFa", receipt.footerFa),
  });
}

function dropUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

/** A section's audit entry, or `null` when the save changed nothing. */
function settingsEntry(
  actor: ActivityActor,
  action: "settings.profileChanged" | "settings.hoursChanged" | "settings.receiptChanged",
  changes: ActivityChange[],
) {
  return changes.length === 0
    ? null
    : {
        actorId: actor.id,
        actorName: actor.name,
        action,
        entityType: "settings" as const,
        entityId: CAFE_SETTINGS_ENTITY_ID,
        changes,
      };
}

/** The hours as flat fields for the activity diff: one per weekday, and the special days as one line. */
function hoursFields(hours: OpeningHours): Record<string, string | null> {
  return {
    ...Object.fromEntries(
      WEEKDAYS.map((day) => [day.toLowerCase(), hours.weekly ? dayHoursValue(hours.weekly[day]) : null]),
    ),
    specialDays:
      hours.exceptions.map((exception) => `${exception.date} ${dayHoursValue(exception)}`).join("; ") || null,
  };
}

/** Everything the site shows about the cafe. A public read: none of it is private. */
export class GetCafeSettings {
  constructor(private readonly settings: Pick<ICafeSettingsRepository, "get">) {}

  execute(): Promise<CafeSettings> {
    return this.settings.get();
  }
}

/** Change who and where the cafe is: names, address, phone, links, map position. */
export class UpdateCafeProfile {
  constructor(private readonly settings: ICafeSettingsRepository) {}

  async execute(profile: CafeProfile, actor: ActivityActor): Promise<CafeSettings> {
    const next = normalizeProfile(profile);
    const before = (await this.settings.get()).profile;
    const fields = (value: CafeProfile) => ({
      name: value.name,
      nameFa: value.nameFa,
      address: value.address,
      addressFa: value.addressFa,
      phone: value.phone,
      instagram: value.instagram,
      website: value.website,
      latitude: value.latitude,
      longitude: value.longitude,
    });
    return this.settings.updateProfile(next, (saved) =>
      settingsEntry(actor, "settings.profileChanged", diffFields(fields(before), fields(saved.profile))),
    );
  }
}

/**
 * Change when the cafe is open: each weekday's hours, and the special days that
 * differ. The hours are shown on the site and tell a guest ordering online when
 * the cafe is closed; they don't restrict bookings or orders (see `isOpenAt`).
 */
export class UpdateOpeningHours {
  constructor(private readonly settings: ICafeSettingsRepository) {}

  async execute(hours: OpeningHours, actor: ActivityActor): Promise<CafeSettings> {
    const next = normalizeHours(hours);
    const before = (await this.settings.get()).hours;
    return this.settings.updateHours(next, (saved) =>
      settingsEntry(actor, "settings.hoursChanged", diffFields(hoursFields(before), hoursFields(saved.hours))),
    );
  }
}

/** Change the lines printed at the top and foot of every receipt. */
export class UpdateReceiptSettings {
  constructor(private readonly settings: ICafeSettingsRepository) {}

  async execute(receipt: ReceiptSettings, actor: ActivityActor): Promise<CafeSettings> {
    const next = normalizeReceipt(receipt);
    const before = (await this.settings.get()).receipt;
    const fields = (value: ReceiptSettings) => ({
      receiptHeader: value.header,
      receiptHeaderFa: value.headerFa,
      receiptFooter: value.footer,
      receiptFooterFa: value.footerFa,
    });
    return this.settings.updateReceipt(next, (saved) =>
      settingsEntry(actor, "settings.receiptChanged", diffFields(fields(before), fields(saved.receipt))),
    );
  }
}
