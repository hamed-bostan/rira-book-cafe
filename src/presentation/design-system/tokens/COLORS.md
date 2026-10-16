# Color roles

Use semantic tokens in components and CSS modules. Define new colors in the
primitive palette and give them a semantic role before using them in a page.
Generate `src/styles/tokens.css` with `npm run generate:tokens`; do not edit it.

| Role | Tokens | Usage |
| --- | --- | --- |
| Brand | `brand` | Original bright green; decoration and chart accents, not small text |
| Actions | `primary`, `primary-hover`, `primary-pressed` | Buttons, links, selected controls; white text on solid fills |
| Green surfaces | `accent`, `accent-strong`, `accent-foreground` | Selection and gentle emphasis; pair tinted fills with dark text |
| Neutrals | `background`, `surface`, `surface-sunken`, `foreground`, `muted-foreground`, `border` | Page structure and text hierarchy |
| Promotions | `discount`, `discount-foreground`, `discount-soft`, `discount-soft-foreground` | Small offer/discount badges; prefer the soft pair in product grids |
| Success | `success`, `success-foreground` | Completed or successful outcomes; include a label or icon |
| Warning | `warning`, `warning-foreground`, `warning-strong` | Pending states, low stock, caution |
| Error | `error`, `error-foreground`, `destructive` | Errors and destructive actions; never promotions |
| Information | `info`, `info-foreground` | Informational states |
| Focus | `ring` | Use the shared focus helpers, which include a contrasting offset |
| Charts | `chart-1` through `chart-6` | Categories; also use labels, patterns, or accessible text |

Keep most of a screen neutral. Green establishes hierarchy; magenta is a small
accent rather than a competing page background. Wallet cards are the deliberate
exception and use dedicated gradients with readable white text.

Normal text pairs must reach 4.5:1; meaningful icons and focus indicators must
reach 3:1 against adjacent light surfaces. Do not lower text opacity to make it
secondary: use `muted-foreground`. Disabled controls and decorative borders have
separate roles and are not normal text pairs.

Run `npm test -- src/presentation/design-system/tokens/semantic/colors.test.ts`
when changing the palette. These checks cover token pairs, not every rendered
screen, overlay, image, or color-vision scenario.
