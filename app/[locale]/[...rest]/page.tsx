import { notFound } from "next/navigation";

/**
 * Catch-all for URLs that match no route under `[locale]`. Without it, an unmatched
 * path falls through to the framework's default (English, unstyled) 404 — there is no
 * root `app/not-found.tsx` because the root layout lives at `app/[locale]/layout.tsx`.
 * Calling `notFound()` here routes those requests to the localized boundary instead.
 */
export default function CatchAllPage(): never {
  notFound();
}
