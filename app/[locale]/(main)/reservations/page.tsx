import { requireAuth } from "@/src/lib/require-auth";
import { MyReservationsScreen } from "@/src/presentation/storefront/reservations/MyReservationsScreen";
import { storefrontServerApi } from "@/src/presentation/storefront/storefront-server-api";

export const dynamic = "force-dynamic";

export default async function MyReservationsPage() {
  await requireAuth();
  const reservations = await storefrontServerApi.myReservations();
  return <MyReservationsScreen reservations={reservations} now={new Date().toISOString()} />;
}
