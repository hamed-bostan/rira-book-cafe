/** Persian (Extended Arabic-Indic) digits ۰–۹ → their ASCII value. */
const PERSIAN_DIGITS = /[۰-۹]/g;
/** Arabic-Indic digits ٠–٩ → their ASCII value. */
const ARABIC_DIGITS = /[٠-٩]/g;

/** Fold Persian/Arabic-Indic digits to ASCII so numbers in a slug stay portable. */
function foldDigits(input: string): string {
  return input
    .replace(PERSIAN_DIGITS, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(ARABIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660));
}

/**
 * Turn a human name into a URL-safe slug. Unicode-aware: Latin text is
 * lowercased and ASCII-hyphenated as before, and Persian/Arabic script is
 * preserved so an `fa` name yields a readable Persian slug (rendered decoded in
 * the browser bar and search results) instead of the empty string the old
 * ASCII-only rule produced.
 *
 * Normalization keeps the same word from ever producing two different slugs:
 *  - NFC-normalize, then map Arabic letter forms to Persian (ي→ی, ك→ک)
 *  - strip Arabic diacritics/tashkil (harakat, tanwin) and the tatweel/kashida
 *  - fold Persian/Arabic-Indic digits to ASCII (۱۲۳ → 123)
 *  - lowercase (a no-op for caseless Persian) and expand "&" → "and"
 *  - collapse every run that isn't a letter or number — spaces, punctuation,
 *    and the zero-width non-joiner (نیم‌فاصله) — into a single hyphen
 *  - trim leading/trailing hyphens
 *
 * Pure — safe on both server and client.
 *
 * @example slugify("Meat & Fish")  // "meat-and-fish"
 * @example slugify("گوشت و ماهی")  // "گوشت-و-ماهی"
 * @example slugify("مینی‌مارکت ۲۴") // "مینی-مارکت-24"
 */
export function slugify(name: string): string {
  return foldDigits(name.normalize("NFC"))
    .replace(/ي/g, "ی") // Arabic yeh → Persian yeh
    .replace(/ك/g, "ک") // Arabic kaf → Persian keheh
    .replace(/[ً-ْـ]/g, "") // harakat/tanwin + tatweel
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}
