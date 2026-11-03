import { redirect } from "next/navigation";

/**
 * The inbox's old address. It's called Messages now (staff write there too), at
 * `/messages`; links and bookmarks to this one still land there.
 */
export default function NotificationsPage(): never {
  redirect("/messages");
}
