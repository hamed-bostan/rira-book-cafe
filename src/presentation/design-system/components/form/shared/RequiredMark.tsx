/**
 * Decorative "required" marker shown next to a field label. The accessible
 * required state is conveyed by the control's `required` / `aria-required`, so
 * this glyph is hidden from assistive tech.
 */
export function RequiredMark() {
  return (
    <span aria-hidden className="ms-0.5 text-destructive">
      *
    </span>
  );
}
