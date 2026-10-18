import { serializeJsonLd, type JsonLdNode } from "./structuredData";

import type { JSX } from "react";

type JsonLdProps = {
  data: JsonLdNode;
};

/** Structured data for search engines (schema.org), as an inline JSON-LD script. */
export function JsonLd({ data }: JsonLdProps): JSX.Element {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
