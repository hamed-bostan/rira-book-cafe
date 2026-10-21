// Elevation shadows. Kept minimal — add an entry here (never a literal
// box-shadow/rgba in component code) as new elevation needs come up.
export const shadow = {
  // Hairline lift for a card on a tinted canvas (the dashboard's tables).
  xs: "0 1px 2px rgba(10, 18, 64, 0.06)",
  subtle: "0 1px 4px rgba(30, 30, 30, 0.07)",
  card: "0 4px 16px rgba(30, 30, 30, 0.02)",
  product: "0 2px 5px rgba(30, 30, 30, 0.02)",
  modal: "0 24px 80px rgba(30, 30, 30, 0.20)",
  // Bottom sheets raised over page content (cart summary bar, checkout sheet).
  sheet: "0 -4px 24px rgba(0, 0, 0, 0.08)",
  // Map marker badges (delivery tracking).
  marker: "0 2px 8px rgba(0, 0, 0, 0.25)",
} as const;
