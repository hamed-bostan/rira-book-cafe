import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { getSiteUrl } from "@/src/lib/siteUrl";
import { JsonLd } from "@/src/presentation/seo/JsonLd";
import { pageMetadata } from "@/src/presentation/seo/pageMetadata";
import { productJsonLd } from "@/src/presentation/seo/structuredData";
import { MenuItemScreen } from "@/src/presentation/storefront/menu/MenuItemScreen";
import { storefrontServerApi } from "@/src/presentation/storefront/storefront-server-api";

import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type MenuItemPageProps = {
  params: Promise<{ id: string }>;
};

/** The item's own title and copy; the same request in the page body is memoized, not refetched. */
export async function generateMetadata({ params }: MenuItemPageProps): Promise<Metadata> {
  const { id } = await params;
  const item = await storefrontServerApi.item(id);
  if (!item) return {};

  return pageMetadata({
    title: item.name,
    description: item.description,
    path: `/menu/${item.id}`,
    image: item.imageUrl ? { url: item.imageUrl, alt: item.name } : undefined,
  });
}

/** One published item; an unpublished or deleted one is the not-found page. */
export default async function MenuItemPage({ params }: MenuItemPageProps) {
  const { id } = await params;
  const [item, reviews, session] = await Promise.all([
    storefrontServerApi.item(id),
    storefrontServerApi.productReviews(id),
    auth(),
  ]);
  if (!item) notFound();
  const signedIn = Boolean(session?.user);
  const [reviewEligibility, waitlist, siteUrl] = await Promise.all([
    signedIn ? storefrontServerApi.myReviewEligibility(id) : null,
    item.kind === "book" ? storefrontServerApi.bookWaitlist(id) : null,
    getSiteUrl(),
  ]);

  return (
    <>
      <JsonLd
        data={productJsonLd({
          product: item,
          url: new URL(`/menu/${item.id}`, siteUrl).toString(),
          image: new URL(item.imageUrl, siteUrl).toString(),
        })}
      />
      <MenuItemScreen
        item={item}
        reviews={reviews}
        reviewEligibility={reviewEligibility}
        waitlist={waitlist}
        signedIn={signedIn}
      />
    </>
  );
}
