import { describe, expect, it } from "vitest";

import type { CafeEvent } from "@/src/domain/entities/CafeEvent";
import type { Product } from "@/src/domain/entities/Product";

import { cafeJsonLd, eventJsonLd, productJsonLd, serializeJsonLd, type CafeIdentity } from "../structuredData";

const CAFE: CafeIdentity = {
  name: "Rira Book Cafe",
  url: "https://rira.example/",
  location: { addressCountry: "IR", openingHours: [] },
};

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    kind: "drink",
    name: "Flat white",
    price: 120_000,
    rating: 0,
    ratingCount: 0,
    stockQuantity: 5,
    imageUrl: "/uploads/products/p1.webp",
    categoryId: "c1",
    isFeatured: false,
    isPublished: true,
    taxExempt: false,
    ...overrides,
  };
}

function event(overrides: Partial<CafeEvent> = {}): CafeEvent {
  return {
    id: "e1",
    kind: "reading",
    title: "Poetry night",
    startsAt: "2026-10-20T16:00:00.000Z",
    endsAt: "2026-10-20T18:00:00.000Z",
    price: 50_000,
    isPublished: true,
    seatsTaken: 0,
    tableLabels: [],
    createdAt: "2026-10-01T08:00:00.000Z",
    updatedAt: "2026-10-01T08:00:00.000Z",
    ...overrides,
  };
}

describe("cafeJsonLd", () => {
  it("states only the location fields that are configured", () => {
    const data = cafeJsonLd({
      ...CAFE,
      description: "Coffee and books",
      image: "https://rira.example/en/opengraph-image",
    });

    expect(data["@type"]).toBe("CafeOrCoffeeShop");
    expect(data.address).toEqual({ "@type": "PostalAddress", addressCountry: "IR" });
    expect(data).not.toHaveProperty("geo");
    expect(data).not.toHaveProperty("openingHoursSpecification");
    expect(data).not.toHaveProperty("telephone");
  });

  it("adds map position and opening hours once they're configured", () => {
    const data = cafeJsonLd({
      ...CAFE,
      location: {
        latitude: 35.7,
        longitude: 51.4,
        openingHours: [{ days: ["Saturday", "Sunday"], opens: "08:00", closes: "23:00" }],
      },
      description: "Coffee and books",
      image: "https://rira.example/en/opengraph-image",
    });

    expect(data.geo).toEqual({ "@type": "GeoCoordinates", latitude: 35.7, longitude: 51.4 });
    expect(data.openingHoursSpecification).toEqual([
      { "@type": "OpeningHoursSpecification", dayOfWeek: ["Saturday", "Sunday"], opens: "08:00", closes: "23:00" },
    ]);
  });
});

describe("productJsonLd", () => {
  const url = "https://rira.example/menu/p1";
  const image = "https://rira.example/uploads/products/p1.webp";

  it("offers a sellable item at its price in Rial, with stock as availability", () => {
    const data = productJsonLd({ product: product({ stockQuantity: 0 }), url, image });

    expect(data.offers).toMatchObject({
      price: 1_200_000,
      priceCurrency: "IRR",
      availability: "https://schema.org/OutOfStock",
    });
    expect(data).not.toHaveProperty("aggregateRating");
  });

  it("gives a reading-only book no offer, and types it as a Book", () => {
    const data = productJsonLd({
      product: product({ kind: "book", book: { author: "Forough Farrokhzad", availability: "reading" } }),
      url,
      image,
    });

    expect(data["@type"]).toEqual(["Product", "Book"]);
    expect(data.author).toEqual({ "@type": "Person", name: "Forough Farrokhzad" });
    expect(data).not.toHaveProperty("offers");
  });

  it("states the rating once guests have reviewed it", () => {
    const data = productJsonLd({ product: product({ rating: 4.5, ratingCount: 12 }), url, image });
    expect(data.aggregateRating).toMatchObject({ ratingValue: 4.5, reviewCount: 12 });
  });
});

describe("eventJsonLd", () => {
  it("dates the event on the cafe's clock and hosts it at the cafe", () => {
    const data = eventJsonLd({
      event: event(),
      title: "Poetry night",
      url: "https://rira.example/events/e1",
      cafe: CAFE,
    });

    expect(data.startDate).toBe("2026-10-20T19:30:00+03:30");
    expect(data.endDate).toBe("2026-10-20T21:30:00+03:30");
    expect(data.location).toMatchObject({
      "@type": "Place",
      name: "Rira Book Cafe",
      address: { addressCountry: "IR" },
    });
    expect(data.offers).toMatchObject({
      price: 500_000,
      priceCurrency: "IRR",
      availability: "https://schema.org/InStock",
    });
    expect(data.isAccessibleForFree).toBe(false);
  });

  it("marks a full event sold out and a free one accessible for free", () => {
    const data = eventJsonLd({
      event: event({ price: 0, capacity: 10, seatsTaken: 10 }),
      title: "Book club",
      url: "https://rira.example/events/e1",
      cafe: CAFE,
    });

    expect(data.offers).toMatchObject({ price: 0, availability: "https://schema.org/SoldOut" });
    expect(data.isAccessibleForFree).toBe(true);
  });
});

describe("serializeJsonLd", () => {
  it("can't be broken out of its script tag", () => {
    const json = serializeJsonLd({ name: "</script><script>alert(1)</script> & more" });

    expect(json).not.toContain("<");
    expect(json).not.toContain(">");
    expect(JSON.parse(json)).toEqual({ name: "</script><script>alert(1)</script> & more" });
  });
});
