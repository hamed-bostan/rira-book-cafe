/**
 * The redesigned dashboard's form type, shared by its dialogs and inline forms so
 * they read the same: labels at body size and medium weight (16px on a phone,
 * 14px from `sm`), hints a step smaller and muted.
 */
export const FIELD_LABEL = "text-body-default font-medium text-foreground sm:text-body-small";

export const FIELD_HINT = "text-body-small font-normal text-pretty text-muted-foreground sm:text-body-caption";

/** What's wrong with one field: the hint's size, medium weight in the danger colour. */
export const FIELD_ERROR = "text-body-small font-medium text-pretty text-error-foreground sm:text-body-caption";

/** A dialog's title: 18px, 20px from `lg`, bold and tight. */
export const DIALOG_TITLE = "text-start text-body-lead tracking-tight lg:text-heading-subsection";

/** A field on a full-page form: the design's 12px inset and stronger hairline. */
export const FIELD_INPUT = "border-border-strong px-3";

/** The multi-line field on the same forms, four lines tall at the 14px text. */
export const FIELD_TEXTAREA = "min-h-24 border-border-strong px-3 py-2 sm:text-body-small";

/** A choice picker's trigger, drawn as a full-width field rather than a toolbar filter. */
export const FIELD_PICKER = "w-full justify-between border-border-strong";

/** Fields sharing a row where they fit, each at least 192px wide. */
export const FIELD_GRID = "grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-4";

/**
 * The floor's tables as tiles to pick from, as many abreast as fit at 7.5rem: two
 * across a phone's dialog, three across a wider one. Narrower, "Long table" broke
 * over two lines and the reason a table can't be had was cut to a word.
 */
export const TABLE_TILE_GRID = "grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2";

/** The two languages' copy: stacked, then side by side from `md`. */
export const LANGUAGE_GRID = "grid grid-cols-1 gap-6 md:grid-cols-2";

/** The small capitals over a group of fields or a value (a language column, "Guest"). */
export const OVERLINE = "text-body-caption font-semibold tracking-wider text-muted-foreground uppercase";

/** A secondary button whose action takes something away (cancel an order, delete an event). */
export const DANGER_SECONDARY = "border-error-border text-error-foreground hover:bg-error active:bg-error";

/** An action drawn as words, keeping a phone's 44px tap target without the height. */
export const TEXT_ACTION =
  "-my-3 py-3 text-body-default font-medium whitespace-nowrap transition-colors disabled:text-disabled-foreground sm:my-0 sm:py-0 sm:text-body-small";
