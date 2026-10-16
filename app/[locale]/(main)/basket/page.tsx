import { auth } from "@/auth";
import { BasketScreen } from "@/src/presentation/storefront/basket/BasketScreen";

/** The basket lives in the browser; the page only needs to know whether the guest can order yet. */
export default async function BasketPage() {
  const session = await auth();
  return <BasketScreen signedIn={Boolean(session?.user)} />;
}
