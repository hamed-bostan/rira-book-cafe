import { normalizePhone } from "@/src/domain/entities/Phone";
import { PLACEHOLDER_USER_NAME } from "@/src/domain/entities/User";

/** An Iranian mobile in its local form: `0` and ten more digits. */
const LOCAL_MOBILE = /^0\d{10}$/;

/**
 * A phone number as people read it, "0912 345 6789". A number that isn't a local
 * mobile (abroad, or typed oddly) is shown as it was stored.
 */
export function formatTeamPhone(phone: string): string {
  const digits = normalizePhone(phone);
  return LOCAL_MOBILE.test(digits) ? `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}` : phone;
}

/**
 * The name to show for a member. Someone given access before their first sign-in
 * still carries the placeholder every new account starts with, which tells them
 * apart from nobody — so their number stands in until they set a name.
 */
export function teamMemberName(name: string | null | undefined, phone: string): string {
  return name && name !== PLACEHOLDER_USER_NAME ? name : formatTeamPhone(phone);
}
