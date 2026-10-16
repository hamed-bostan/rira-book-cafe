export const typography = {
  fontFamily: {
    // Resolved by document language: Inter for English, Vazirmatn for Persian.
    sans: "var(--font-ui), sans-serif",
  },

  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  fontSize: {
    12: "0.75rem", // 12px
    14: "0.875rem", // 14px
    16: "1rem", // 16px
    18: "1.125rem", // 18px
    20: "1.25rem", // 20px
    24: "1.5rem", // 24px
    32: "2rem", // 32px
  },

  lineHeight: {
    // Unitless ratios scale with browser font preferences and inherited text.
    heading: "1.4",
    body: "1.5",
    reading: "1.75",
  },
} as const;
