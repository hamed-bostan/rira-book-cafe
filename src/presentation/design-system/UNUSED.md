# Unused design-system pieces

Nothing in the app imports these as of 2026-10-23 — after the dashboard redesigns
(Overview, Orders, Bar display, Tables, Suite, Events, Book loans, Book holds,
sidebar) and the Landing page. They are kept on purpose, not deleted: reuse them,
or remove them in a later cleanup. Check again before deleting (see the end).

## Components

| Component                     | Path                             | What it is                                                 | Note                                                                                                                                      |
| ----------------------------- | -------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Accordion                     | `components/Accordion/`          | Disclosure list on Radix Accordion                         | Its open/close animation (`--animate-accordion-*` and the `accordion-*` keyframes) in `src/styles/globals.css` serves only it             |
| Chip                          | `components/Chip/Chip.tsx`       | Single-select chip group on Radix RadioGroup               | `ToggleChip` in the same folder **is** used; `chipRadioStateStyles` in `chipStyles.ts` serves only `Chip`                                 |
| FilterTabs                    | `components/FilterTabs/`         | Single-select filter bar (pill tabs) on Radix RadioGroup   | Dashboard tabs now use `dashboard/DashboardLinkTabs` (one link per tab)                                                                   |
| SelectableTile                | `components/SelectableTile/`     | A whole card acting as one option in a single-select group | `focusRingWithin` in `shared/focusRing.ts` serves only it                                                                                 |
| FloatingField, FloatingLabel  | `components/form/FloatingField/` | Form field whose label floats above the value              |                                                                                                                                           |
| PasswordInput, PasswordToggle | `components/form/PasswordInput/` | Password field with a show/hide toggle                     | Sign-in is by one-time code, so there are no password fields                                                                              |
| ChartContainer, ChartTooltip  | `chart/`                         | The Recharts wrapper and its tooltip                       | Unused since the Reports redesign (2026-10-27) drew its bars by hand like the Overview; the `recharts` dependency serves only this folder |
| ChartLegend                   | `chart/ChartLegend.tsx`          | The legend row for multi-series charts                     |                                                                                                                                           |

## Icons

`InstagramIcon`, `WhatsappIcon`, `YoutubeIcon` — the whole `icons/` folder.

## CSS

- `.reading-text` in `src/styles/globals.css` — long-form text (articles, policies).
- The Accordion animation, above.

## Entry files nobody imports

The app imports design-system components by their file path, so these folders'
`index.ts` re-exports go unused (the components themselves are in use): Avatar,
Badge, Checkbox, Chip, DataTable, DropdownMenu, Modal, Popover, RatingStars, Sheet,
Skeleton, Switch, Tabs, Thumbnail, `form` and `form/OTPInput`, `form/Select`,
`form/TextField`, `form/Textarea`, and `tokens/index.ts`.

## How this was found

An import graph built with the TypeScript compiler from every route file under
`app/` (page, layout, loading, route, …), the root config files and `scripts/`:
files it never reaches are unused. Exports were then checked by name across `src/`
and `app/`. Before deleting anything here, check that it's still unused — a page
may have started using it since.
