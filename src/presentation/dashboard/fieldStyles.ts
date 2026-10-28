/**
 * The redesigned dashboard's form type, shared by its dialogs and inline forms so
 * they read the same: labels at body size and medium weight (16px on a phone,
 * 14px from `sm`), hints a step smaller and muted.
 */
export const FIELD_LABEL = "text-body-default font-medium text-foreground sm:text-body-small";

export const FIELD_HINT = "text-body-small font-normal text-pretty text-muted-foreground sm:text-body-caption";

/** A dialog's title: 18px, 20px from `lg`, bold and tight. */
export const DIALOG_TITLE = "text-start text-body-lead tracking-tight lg:text-heading-subsection";
