import { ImageResponse } from "next/og";

import { neutral, primary } from "@/src/presentation/design-system/tokens/primitives/colors";

/**
 * The site's default share card (1200×630), used by every page without a photo of
 * its own — menu items and events share their own image instead (see
 * `src/presentation/seo/pageMetadata.ts`). It takes no request data, so it's
 * prerendered at build time (one per locale segment, from the layout's static
 * params) and served as a static PNG. It lives under `[locale]` so it resolves
 * against the layout's `metadataBase`, and `proxy.ts` lets `/<locale>/opengraph-image`
 * through without the locale redirect. The copy is Latin-only — the renderer doesn't
 * shape right-to-left scripts — so the built-in font covers it and no font file has
 * to ship with the server.
 */
export const alt = "Rira Book Cafe — coffee, food and books";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 40,
          background: `linear-gradient(135deg, ${primary[600]} 0%, ${primary[800]} 100%)`,
          color: neutral[0],
        }}
      >
        <div
          style={{
            width: 168,
            height: 168,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 9999,
            background: neutral[0],
          }}
        >
          {/* lucide "coffee" — the same mark as the site header's BrandMark. */}
          <svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke={primary[600]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 2v2" />
            <path d="M14 2v2" />
            <path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" />
            <path d="M6 2v2" />
          </svg>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 88, fontWeight: 700, letterSpacing: -2 }}>Rira Book Cafe</div>
          <div style={{ fontSize: 40, color: primary[100] }}>Coffee · Food · Books</div>
        </div>
      </div>
    ),
    size,
  );
}
