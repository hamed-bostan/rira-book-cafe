/** Days of the week as schema.org spells them (`https://schema.org/DayOfWeek`). */
export type Weekday = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";

/** One opening-hours rule on the cafe's wall clock, e.g. Saturday–Wednesday 08:00–23:00. */
export type OpeningHoursRule = {
  days: Weekday[];
  /** `HH:mm` */
  opens: string;
  /** `HH:mm` */
  closes: string;
};

export type CafeLocation = {
  streetAddress?: string;
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
  /** ISO 3166-1 alpha-2. */
  addressCountry?: string;
  latitude?: number;
  longitude?: number;
  /** International format, e.g. `+98 21 1234 5678`. */
  telephone?: string;
  openingHours: OpeningHoursRule[];
};

/**
 * Where and when the cafe is, for search engines' structured data (the JSON-LD on
 * the home page and on events). The app doesn't store any of this yet, so only what
 * is certain is filled in: prices are in Toman, so the cafe is in Iran. Add the real
 * street address, map position, phone and hours here — every field left empty is
 * simply left out of the markup rather than guessed.
 */
export const CAFE_LOCATION: CafeLocation = {
  addressCountry: "IR",
  openingHours: [],
};
