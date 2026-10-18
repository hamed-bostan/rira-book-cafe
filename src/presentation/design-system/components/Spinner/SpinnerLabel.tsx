import { useTranslations } from "next-intl";

/**
 * The spinner's screen-reader text. Split out of `<Spinner>` so the translation
 * hook only runs for an announcing spinner — a decorative one (inside a button)
 * stays a plain glyph with no i18n dependency.
 */
export function SpinnerLabel({ label }: { label?: string }) {
  const t = useTranslations("ds");

  return <span className="sr-only">{label ?? t("loading")}</span>;
}
