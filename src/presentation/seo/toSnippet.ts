/** Search snippets are cut around 155–160 characters; longer copy only gets truncated by the engine. */
const MAX_DESCRIPTION_LENGTH = 160;

/** Collapse whitespace and trim to a snippet-sized string, ending on a word boundary when possible. */
export function toSnippet(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= MAX_DESCRIPTION_LENGTH) return flat;

  const cut = flat.slice(0, MAX_DESCRIPTION_LENGTH - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > MAX_DESCRIPTION_LENGTH / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
