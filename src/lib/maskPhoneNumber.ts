/**
 * Masks a phone number for list views while retaining enough context for an
 * operator to distinguish nearby records. Detail screens may show the full value.
 */
export function maskPhoneNumber(phone: string): string {
  const value = phone.trim();
  if (!value) return "";

  if (value.length <= 4) return "•".repeat(value.length);
  if (value.length <= 8) return `${value.slice(0, 2)}${"•".repeat(value.length - 4)}${value.slice(-2)}`;

  return `${value.slice(0, 4)}${"•".repeat(value.length - 8)}${value.slice(-4)}`;
}
