import { seatsLeft, type CafeEvent } from "@/src/domain/entities/CafeEvent";
import { CAFE_UTC_OFFSET, dateToWallTime } from "@/src/domain/entities/CafeTime";
import { isSellable, type Product } from "@/src/domain/entities/Product";
import { isSoldOut } from "@/src/domain/entities/stock";
import type { CafeLocation } from "@/src/lib/cafeLocation";

/** A JSON-LD node: plain JSON, so it serializes into a `<script>` as is. */
export type JsonLdNode = { [key: string]: JsonLdValue };
type JsonLdValue = string | number | boolean | JsonLdNode | JsonLdValue[];

const SCHEMA_CONTEXT = "https://schema.org";

/**
 * Prices are stored in Toman, which has no ISO 4217 code; schema.org wants one, so
 * offers are stated in Rial (IRR, 10 Rial to the Toman) — the same conversion the
 * payment gateway makes.
 */
const RIAL_PER_TOMAN = 10;
const PRICE_CURRENCY = "IRR";

/** Valid in JSON but line terminators in a JS `<script>`, so they're escaped too. */
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

export type CafeIdentity = {
  /** The cafe's display name, in the page's language. */
  name: string;
  /** The site's home URL (absolute). */
  url: string;
  location: CafeLocation;
};

/** The cafe as a business: name, site, share image and whatever address, map position and hours are configured. */
export function cafeJsonLd({
  name,
  url,
  location,
  description,
  image,
}: CafeIdentity & { description: string; image: string }): JsonLdNode {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "CafeOrCoffeeShop",
    "@id": `${url}#cafe`,
    name,
    description,
    url,
    image,
    ...cafePlaceFields(location),
    ...(location.telephone ? { telephone: location.telephone } : {}),
    ...(location.openingHours.length > 0
      ? {
          openingHoursSpecification: location.openingHours.map((rule) => ({
            "@type": "OpeningHoursSpecification",
            dayOfWeek: rule.days,
            opens: rule.opens,
            closes: rule.closes,
          })),
        }
      : {}),
  };
}

type ProductJsonLdInput = {
  product: Product;
  /** The item page's absolute URL. */
  url: string;
  /** The item photo's absolute URL. */
  image: string;
};

/**
 * A menu item. A book is also typed `Book` (author, ISBN). The offer is what a guest
 * can really do on the site: buy it at the listed price, in stock or not; a book
 * that's for reading at the cafe only has no offer. Ratings are guests' approved
 * reviews, so they're only stated once there is at least one.
 */
export function productJsonLd({ product, url, image }: ProductJsonLdInput): JsonLdNode {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": product.book ? ["Product", "Book"] : "Product",
    "@id": `${url}#product`,
    name: product.name,
    url,
    image,
    ...(product.description ? { description: product.description } : {}),
    ...(product.book
      ? {
          author: { "@type": "Person", name: product.book.author },
          ...(product.book.isbn ? { isbn: product.book.isbn } : {}),
        }
      : {}),
    ...(isSellable(product)
      ? {
          offers: {
            "@type": "Offer",
            url,
            price: product.price * RIAL_PER_TOMAN,
            priceCurrency: PRICE_CURRENCY,
            // A made-to-order item is never out of stock by count.
            availability: `${SCHEMA_CONTEXT}/${isSoldOut(product) ? "OutOfStock" : "InStock"}`,
          },
        }
      : {}),
    ...(product.ratingCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.rating,
            reviewCount: product.ratingCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };
}

type EventJsonLdInput = {
  event: CafeEvent;
  /** Title and description in the page's language. */
  title: string;
  description?: string;
  /** The event page's absolute URL. */
  url: string;
  /** The cover's absolute URL, when the event has one. */
  image?: string;
  /** The cafe hosting it — the event's venue and organizer. */
  cafe: CafeIdentity;
};

/**
 * An event at the cafe: when (on the cafe's clock), where (the cafe), and a seat
 * offer at its real price — sold out once every seat is taken. Free events are
 * offered at 0 and flagged accessible for free.
 */
export function eventJsonLd({ event, title, description, url, image, cafe }: EventJsonLdInput): JsonLdNode {
  const left = seatsLeft(event);

  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Event",
    "@id": `${url}#event`,
    name: title,
    url,
    ...(description ? { description } : {}),
    ...(image ? { image } : {}),
    startDate: toCafeIsoDateTime(event.startsAt),
    endDate: toCafeIsoDateTime(event.endsAt),
    eventStatus: `${SCHEMA_CONTEXT}/EventScheduled`,
    eventAttendanceMode: `${SCHEMA_CONTEXT}/OfflineEventAttendanceMode`,
    location: { "@type": "Place", name: cafe.name, url: cafe.url, ...cafePlaceFields(cafe.location) },
    organizer: { "@type": "Organization", name: cafe.name, url: cafe.url },
    isAccessibleForFree: event.price === 0,
    offers: {
      "@type": "Offer",
      url,
      price: event.price * RIAL_PER_TOMAN,
      priceCurrency: PRICE_CURRENCY,
      availability: `${SCHEMA_CONTEXT}/${left === 0 ? "SoldOut" : "InStock"}`,
      validFrom: toCafeIsoDateTime(event.createdAt),
    },
  };
}

/**
 * Serialize for an inline `<script type="application/ld+json">`. `JSON.stringify`
 * leaves `<` as is, so staff-written copy containing `</script>` could break out of
 * the tag; escaping `<`, `>` and `&` (and the JS line separators) keeps it inert.
 */
export function serializeJsonLd(data: JsonLdNode): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replaceAll(LINE_SEPARATOR, "\\u2028")
    .replaceAll(PARAGRAPH_SEPARATOR, "\\u2029");
}

/** The address and map position of a place, as far as they're configured. */
function cafePlaceFields(location: CafeLocation): JsonLdNode {
  const address: JsonLdNode = {
    ...(location.streetAddress ? { streetAddress: location.streetAddress } : {}),
    ...(location.addressLocality ? { addressLocality: location.addressLocality } : {}),
    ...(location.addressRegion ? { addressRegion: location.addressRegion } : {}),
    ...(location.postalCode ? { postalCode: location.postalCode } : {}),
    ...(location.addressCountry ? { addressCountry: location.addressCountry } : {}),
  };
  const hasGeo = location.latitude !== undefined && location.longitude !== undefined;

  return {
    ...(Object.keys(address).length > 0 ? { address: { "@type": "PostalAddress", ...address } } : {}),
    ...(hasGeo
      ? { geo: { "@type": "GeoCoordinates", latitude: location.latitude ?? 0, longitude: location.longitude ?? 0 } }
      : {}),
  };
}

/** A UTC instant as an ISO 8601 timestamp on the cafe's clock (`2026-10-20T19:30:00+03:30`). */
function toCafeIsoDateTime(instant: string): string {
  return `${dateToWallTime(new Date(instant))}:00${CAFE_UTC_OFFSET}`;
}
