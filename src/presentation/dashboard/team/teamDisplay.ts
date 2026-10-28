import { PLACEHOLDER_USER_NAME } from "@/src/domain/entities/User";
import { formatPhone } from "@/src/lib/formatPhone";

/**
 * The name to show for a member. Someone given access before their first sign-in
 * still carries the placeholder every new account starts with, which tells them
 * apart from nobody — so their number stands in until they set a name.
 */
export function teamMemberName(name: string | null | undefined, phone: string): string {
  return name && name !== PLACEHOLDER_USER_NAME ? name : formatPhone(phone);
}

/**
 * What a member's avatar shows: their two leading initials ("Sara Ahmadi" → "SA"),
 * or "#" while their number stands in for a name — a number has no initials.
 */
export function teamMemberInitials(name: string, phone: string): string {
  if (name === formatPhone(phone)) return "#";
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
