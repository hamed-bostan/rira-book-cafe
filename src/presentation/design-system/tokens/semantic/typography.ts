import { typography as p } from "../primitives/typography";

const style = (
  size: keyof typeof p.fontSize,
  weight: keyof typeof p.fontWeight,
  leading: keyof typeof p.lineHeight = "body",
) => ({
  size: p.fontSize[size],
  lineHeight: p.lineHeight[leading],
  weight: p.fontWeight[weight],
  family: p.fontFamily.sans,
});

const page = style(32, "bold", "heading");
const section = style(24, "bold", "heading");
const subsection = style(20, "bold", "heading");
const body = style(16, "regular");
const small = style(14, "regular");
const caption = style(12, "regular");
const label = style(14, "medium");
const compactLabel = style(12, "semibold");
const action = style(16, "semibold");
const compactAction = style(14, "semibold");

/**
 * Names describe a role, optional size, and optional emphasis or weight.
 * Each token is a complete style so component overrides replace it atomically.
 * Sizes are nominal CSS pixels at a 16px browser default, never a root reset.
 */
export const typography = {
  heading: {
    page,
    section,
    subsection,
    subsectionMedium: style(20, "medium", "heading"),
  },
  body: {
    default: body,
    strong: style(16, "semibold"),
    small,
    caption,
    reading: style(16, "regular", "reading"),
    lead: style(18, "bold"),
    intro: style(18, "regular"),
    emphasis: style(16, "medium"),
    bold: style(16, "bold"),
    smallEmphasis: style(14, "medium"),
    smallStrong: style(14, "semibold"),
    smallBold: style(14, "bold"),
    captionEmphasis: style(12, "medium"),
    captionBold: style(12, "bold"),
  },
  button: {
    default: action,
    compact: compactAction,
    compactMedium: style(14, "medium"),
    defaultMedium: style(16, "medium"),
  },
  label: {
    default: label,
    compact: compactLabel,
    compactMedium: style(12, "medium"),
  },
} as const;
