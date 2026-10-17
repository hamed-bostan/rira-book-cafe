import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { MenuItemScreen } from "@/src/presentation/storefront/menu/MenuItemScreen";
import { storefrontServerApi } from "@/src/presentation/storefront/storefront-server-api";

export const dynamic = "force-dynamic";

type MenuItemPageProps = {
  params: Promise<{ id: string }>;
};

/** One published item; an unpublished or deleted one is the not-found page. */
export default async function MenuItemPage({ params }: MenuItemPageProps) {
  const { id } = await params;
  const [item, reviews, session] = await Promise.all([storefrontServerApi.item(id), storefrontServerApi.productReviews(id), auth()]);
  if (!item) notFound();
  const signedIn = Boolean(session?.user);
  const [reviewEligibility, waitlist] = await Promise.all([
    signedIn ? storefrontServerApi.myReviewEligibility(id) : null,
    item.kind === "book" ? storefrontServerApi.bookWaitlist(id) : null,
  ]);

  return (
    <MenuItemScreen item={item} reviews={reviews} reviewEligibility={reviewEligibility} waitlist={waitlist} signedIn={signedIn} />
  );
}
