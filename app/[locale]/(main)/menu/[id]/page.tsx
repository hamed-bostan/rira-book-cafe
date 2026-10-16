import { notFound } from "next/navigation";

import { MenuItemScreen } from "@/src/presentation/storefront/menu/MenuItemScreen";
import { storefrontServerApi } from "@/src/presentation/storefront/storefront-server-api";

export const dynamic = "force-dynamic";

type MenuItemPageProps = {
  params: Promise<{ id: string }>;
};

/** One published item; an unpublished or deleted one is the not-found page. */
export default async function MenuItemPage({ params }: MenuItemPageProps) {
  const { id } = await params;
  const item = await storefrontServerApi.item(id);
  if (!item) notFound();

  return <MenuItemScreen item={item} />;
}
