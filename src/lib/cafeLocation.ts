import {
  instagramUrl,
  inLanguage,
  openingRules,
  upcomingExceptions,
  type CafeSettings,
  type OpeningHoursRule,
} from "@/src/domain/entities/CafeSettings";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";

/** A day whose hours differ from the week's, for structured data — closed when it has no times. */
export type SpecialHours = { date: string; opens?: string; closes?: string };

/** Where and when the cafe is, as search engines' structured data states it. */
export type CafeLocation = {
  /** The address as staff wrote it, in the page's language. */
  streetAddress?: string;
  /** ISO 3166-1 alpha-2. */
  addressCountry?: string;
  latitude?: number;
  longitude?: number;
  telephone?: string;
  openingHours: OpeningHoursRule[];
  /** The special days coming up (holidays, late nights). */
  specialHours: SpecialHours[];
  /** The cafe's own pages elsewhere: its Instagram, its website. */
  sameAs: string[];
};

/**
 * The cafe's location for structured data (the JSON-LD on the home page and on
 * events), from its settings. Only what's set is stated: prices are in Toman, so
 * the cafe is in Iran; the address, map position, phone, hours and links appear
 * once staff fill them in — nothing is guessed.
 */
export function cafeLocationFrom(settings: CafeSettings, locale: string, now: Date = new Date()): CafeLocation {
  const { profile, hours } = settings;
  const hasGeo = profile.latitude !== undefined && profile.longitude !== undefined;
  return {
    streetAddress: inLanguage(locale, profile.address, profile.addressFa)?.replace(/\s*\n\s*/g, ", "),
    addressCountry: "IR",
    ...(hasGeo ? { latitude: profile.latitude, longitude: profile.longitude } : {}),
    telephone: profile.phone,
    openingHours: hours.weekly ? openingRules(hours.weekly) : [],
    specialHours: upcomingExceptions(hours, cafeDayOf(now)).map((exception) =>
      exception.closed
        ? { date: exception.date }
        : { date: exception.date, opens: exception.opens, closes: exception.closes },
    ),
    sameAs: [profile.instagram ? instagramUrl(profile.instagram) : undefined, profile.website].filter(
      (url): url is string => url !== undefined,
    ),
  };
}
