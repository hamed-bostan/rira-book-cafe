import { describe, expect, it } from "vitest";

import { isPlausiblePhone, isTeamPhone, normalizePhone, phoneDigits, teamPhoneDigitsWhenComplete } from "../Phone";

describe("normalizePhone", () => {
  it("rewrites +98 and 98 to the local 0 form", () => {
    for (const phone of ["+98 912 345 6789", "989123456789", "98-912-345-6789", "0912 (345) 6789"]) {
      expect(normalizePhone(phone)).toBe("09123456789");
    }
  });

  it("reads Persian and Arabic-Indic digits as the digits they are", () => {
    expect(normalizePhone("۰۹۱۲ ۳۴۵ ۶۷۸۹")).toBe("09123456789");
    expect(normalizePhone("+٩٨ ٩١٢ ٣٤٥ ٦٧٨٩")).toBe("09123456789");
    expect(normalizePhone("0912 ۳۴۵ ٦٧٨٩")).toBe("09123456789");
  });

  it("keeps a foreign number's digits as typed", () => {
    expect(normalizePhone("+44 20 7946 0958")).toBe("442079460958");
  });

  it("leaves an id — an already normalized number — unchanged", () => {
    for (const id of ["09123456789", "02112345678", "442079460958", "00989123456789", "9891234567"]) {
      expect(normalizePhone(id)).toBe(id);
    }
  });
});

describe("phoneDigits", () => {
  it("keeps only digits, folding Persian ones, without rewriting the country code", () => {
    expect(phoneDigits("+98 ۹۱۲-345 6789")).toBe("989123456789");
  });
});

describe("isPlausiblePhone", () => {
  it("still takes a landline", () => {
    expect(isPlausiblePhone("021 1234 5678")).toBe(true);
    expect(isPlausiblePhone("0912")).toBe(false);
  });
});

describe("isTeamPhone", () => {
  it("takes a complete Iranian mobile however it's typed", () => {
    for (const phone of [
      "09123456789",
      " 0912 345 6789 ",
      "0912-345-6789",
      "0912 (345) 6789",
      "+989123456789",
      "+98 912 345 6789",
      "98 912 345 6789",
      "۰۹۱۲۳۴۵۶۷۸۹",
      "+٩٨ ٩١٢ ٣٤٥ ٦٧٨٩",
    ]) {
      expect(isTeamPhone(phone)).toBe(true);
    }
  });

  it("refuses an Iranian number that isn't a complete mobile", () => {
    for (const phone of [
      "0912345678", // a digit short
      "091234567890", // a digit over
      "02112345678", // a Tehran landline
      "+98 21 1234 5678",
      "+98 912 345 678",
      "9123456789", // no leading 0
      "08123456789",
      "0098 912 345 6789",
    ]) {
      expect(isTeamPhone(phone)).toBe(false);
    }
  });

  it("takes a foreign number typed with its +, of 8 to 15 digits", () => {
    for (const phone of ["+44 20 7946 0958", "+1 (415) 555-0100", "+4930123456", "+12345678", `+1${"2".repeat(14)}`]) {
      expect(isTeamPhone(phone)).toBe(true);
    }
  });

  it("refuses a foreign number without its +, too short or too long, or with a 0 for a country code", () => {
    for (const phone of ["44 20 7946 0958", "+1234567", `+1${"2".repeat(15)}`, "+0123456789"]) {
      expect(isTeamPhone(phone)).toBe(false);
    }
  });

  it("refuses letters and a leading separator", () => {
    for (const phone of ["", "phone 09123456789", "0912345678x9", "-09123456789", "++989123456789"]) {
      expect(isTeamPhone(phone)).toBe(false);
    }
  });
});

describe("teamPhoneDigitsWhenComplete", () => {
  it("expects 11 digits for 09…, 12 for +98…/98…, and up to 15 for a foreign number", () => {
    expect(teamPhoneDigitsWhenComplete("0912")).toBe(11);
    expect(teamPhoneDigitsWhenComplete("+98 912")).toBe(12);
    expect(teamPhoneDigitsWhenComplete("98912")).toBe(12);
    expect(teamPhoneDigitsWhenComplete("+٩٨ ٩١٢")).toBe(12);
    expect(teamPhoneDigitsWhenComplete("+44 20")).toBe(15);
  });
});
