import { redirect } from "next/navigation";

import { requirePermission } from "@/src/lib/require-permission";

/**
 * Recording an expense is a dialog on the Expenses page; this address — linked
 * from Accounting's "Record expense" — opens the list with that dialog up.
 */
export default async function NewExpensePage() {
  await requirePermission("accounting.write");
  redirect("/dashboard/expenses?record=1");
}
