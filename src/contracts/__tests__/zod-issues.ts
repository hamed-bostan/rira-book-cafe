import type { ZodError } from "zod";

/** Either branch of a `safeParse` result — only the error side is read. */
type ParseResult = { success: boolean; error?: ZodError };

/**
 * The messages of the issues sitting at exactly `path`, dot-joined (`"lines.0.debit"`);
 * `""` is the root. For nested paths, where `flatten().fieldErrors` only keys the
 * first segment.
 */
export function messagesAt(result: ParseResult, path: string): string[] {
  return (result.error?.issues ?? []).filter((issue) => issue.path.join(".") === path).map((issue) => issue.message);
}
