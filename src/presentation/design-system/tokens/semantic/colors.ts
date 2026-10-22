import {
  primary,
  magenta,
  neutral,
  success,
  error,
  warning,
  info,
  amber,
  navy,
  teal,
  blue,
  slate,
  warmNeutral,
} from "../primitives/colors";

export const colors = {
  background: neutral[0],
  foreground: neutral[950],
  // What a page's cards and tables sit on. The same white as `background` by
  // default; a theme (see `themes.ts`) can tint it so the cards lift off it.
  canvas: neutral[0],

  surface: {
    // Default elevated neutral fill used across cards, panels, inputs and wells.
    DEFAULT: neutral[50],
    // Deeper, recessed step for sunken areas (category tiles, nested image wells).
    sunken: neutral[75],
  },

  popover: {
    DEFAULT: neutral[0],
    foreground: neutral[950],
  },

  // Bright brand color is reserved for decoration and data, never small text.
  brand: primary[500],

  primary: {
    DEFAULT: primary[600],
    foreground: neutral[0],
    // Rest → hover → pressed is a three-step ladder, so a pointer user gets
    // feedback on hover that still visibly deepens on press.
    hover: primary[700],
    pressed: primary[800],
  },

  disabled: {
    DEFAULT: neutral[100],
    foreground: neutral[300],
    border: neutral[300],
  },

  magenta: {
    DEFAULT: magenta[500],
    foreground: neutral[0],
  },

  muted: {
    DEFAULT: neutral[50],
    foreground: neutral[500],
    strong: neutral[100],
  },

  accent: {
    DEFAULT: primary[50],
    foreground: primary[700],
    strong: primary[100],
    border: primary[200],
  },

  destructive: {
    DEFAULT: error[500],
    foreground: neutral[0],
  },

  // Each status's `border` outlines an `outline` badge. By default it's the text
  // colour; a theme can soften it to a tint.
  success: {
    DEFAULT: success[100],
    foreground: success[700],
    border: success[700],
  },

  warning: {
    DEFAULT: warning[100],
    foreground: warning[700],
    strong: warning[800],
    border: warning[700],
  },

  info: {
    DEFAULT: info[100],
    foreground: info[700],
    border: info[700],
  },

  error: {
    DEFAULT: error[100],
    foreground: error[700],
    border: error[700],
  },

  icon: {
    muted: neutral[500],
    // A coloured glyph that carries meaning beside text (a table or a bag in a row).
    accent: info[700],
  },

  // Rating stars (and gold decorative glyphs such as the cash-on-delivery coin).
  rating: amber[600],

  input: {
    // Standard (outline) form field fill — white, paired with a border so it
    // reads on white page backgrounds.
    DEFAULT: neutral[0],
    // Filled-variant fill — the borderless grey well used by search fields.
    filled: neutral[50],
    foreground: neutral[700],
    placeholder: neutral[500],
  },

  // Promotional emphasis stays separate from destructive/error red.
  discount: {
    DEFAULT: magenta[500],
    foreground: neutral[0],
    soft: magenta[50],
    softForeground: magenta[600],
  },

  // Categorical ramp for data visualization. Charts pick a color by position
  // (`chart[1]` first), so a single-series chart renders in the same brand color
  // used everywhere else, and multi-series charts stay legible without repeating a
  // hue. Built from existing brand hues rather than new ones, so a chart's palette
  // is never a system of its own — see `presentation/design-system/chart/`.
  chart: {
    1: primary[500],
    2: info[500],
    3: magenta[500],
    4: warning[700],
    5: error[500],
    6: neutral[500],
  },

  border: {
    DEFAULT: neutral[200],
    // Hovered outlines, and controls that must read against a tinted surface.
    strong: neutral[300],
  },
  ring: primary[700],

  // The home page's own system, one-for-one with the design's semantic tokens
  // (`--color-ink` → `landing.ink`, …): navy ink on a warm page and a pale blue
  // band, with teal actions. To restyle the home page, repoint these.
  landing: {
    // Headings, primary text, links.
    ink: navy[900],
    // Body copy, nav links.
    inkSoft: slate[800],
    // Descriptions, captions, notes.
    inkMuted: slate[600],
    // Wordmark only.
    logoGray: warmNeutral[500],
    // Buttons, active states, highlights.
    primary: teal[600],
    primaryHover: teal[700],
    onPrimary: neutral[0],
    // Eyebrow labels.
    accent: blue[600],
    // Icons.
    icon: blue[700],
    // Page background.
    background: warmNeutral[50],
    // Alternating section background.
    band: blue[50],
    // Dividers, outlines.
    border: slate[200],
  },

  // Wallet card brand gradients (green / magenta), cycled per card.
  wallet: {
    primaryFrom: primary[600],
    primaryTo: primary[800],
    magentaFrom: magenta[500],
    magentaTo: magenta[800],
  },
} as const;
