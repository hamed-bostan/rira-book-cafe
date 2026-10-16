import type { Locale } from "@/src/i18n/routing";

import { formatNumber } from "./formatNumber";

/**
 * Human-readable file size ("1.8 MB") for the Export summary sidebar's
 * "Estimated size" — the only place in the app that shows a byte count to an
 * admin. Binary units (1024-based, matching what OS file pickers report)
 * rather than decimal, since that's what an admin comparing this to their
 * download folder expects.
 */
const UNITS = ["B", "KB", "MB", "GB"] as const;

export function formatByteSize(bytes: number, locale: Locale): string {
  if (bytes <= 0) return `0 ${UNITS[0]}`;
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${formatNumber(value, locale, exponent > 0 && value < 10 ? 1 : 0)} ${UNITS[exponent]}`;
}
