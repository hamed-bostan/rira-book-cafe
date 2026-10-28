import { normalizePhone } from "@/src/domain/entities/Phone";

/** An Iranian mobile in its local form: `0` and ten more digits. */
const LOCAL_MOBILE = /^0\d{10}$/;

/**
 * A phone number as people read it, "0912 345 6789". A number that isn't a local
 * mobile (abroad, or typed oddly) is shown as it was stored.
 */
export function formatPhone(phone: string): string {
  const digits = normalizePhone(phone);
  return LOCAL_MOBILE.test(digits) ? `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}` : phone;
}
