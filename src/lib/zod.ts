import { config } from "zod/mini";
import en from "zod/v4/locales/en.js";

/**
 * zod/mini for schemas whose messages reach people: the shared contracts (form errors,
 * the API's `fieldErrors`), the API's query-parameter schemas and the env check.
 *
 * The app validates with `zod/mini` only — classic `zod` costs every page with a form
 * about 17 kB, and keeps zod's shared core twice the size on every other page (see
 * the lint rule that bans it). Classic did one thing implicitly that mini doesn't: it
 * installs zod's English messages, so an issue without a message of its own reads
 * `Invalid option: expected one of …` rather than mini's bare `Invalid input`.
 * Installing them here keeps those messages. `config` is global (zod keeps it on
 * `globalThis`), so the first schema module to load sets it for every schema.
 *
 * Response schemas (`*-response-schema.ts`) import `zod/mini` directly: their issues
 * are only logged, so a page that only reads data doesn't download these messages.
 */
config(en());

// Contracts `import * as z from "@/src/lib/zod"`: through a star re-export the bundler
// still sees each `z.object`, `z.string`, … and keeps only those. Re-exporting mini's `z`
// object instead (`export { z }`) hides that and ships the whole of zod/mini.
export * from "zod/mini";
