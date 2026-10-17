import type { StatementLineFormInput } from "@/src/contracts/bank-schema";
import { isCafeDay } from "@/src/domain/entities/CafeTime";
import { fromJalali, jalaliMonthLength } from "@/src/domain/entities/JalaliCalendar";

/**
 * Read bank statement lines pasted from a bank's export (CSV, or columns copied
 * out of a spreadsheet). Two layouts are understood:
 *
 *   date, description, amount[, reference]                 — signed amount (− money out)
 *   date, description, withdrawal, deposit, reference      — Iranian banks' two columns
 *
 * Dates may be Gregorian (2026-10-16) or Persian (1405/07/24, read as Jalali when
 * the year is below 1700). Persian and Arabic digits and thousands separators are
 * accepted. A first row that isn't a line is taken as a header and skipped; other
 * rows that can't be read are reported by number rather than guessed at.
 */

export type ParsedStatement = { lines: StatementLineFormInput[]; skippedRows: number[] };

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function toAsciiDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => {
    const persian = PERSIAN_DIGITS.indexOf(digit);
    return String(persian >= 0 ? persian : ARABIC_DIGITS.indexOf(digit));
  });
}

function splitRow(row: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < row.length; index += 1) {
    const char = row[index];
    if (quoted) {
      if (char === '"' && row[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells.map((value) => value.trim());
}

function detectDelimiter(rows: readonly string[]): string {
  const sample = rows.slice(0, 5).join("\n");
  if (sample.includes("\t")) return "\t";
  return (sample.match(/;/g)?.length ?? 0) > (sample.match(/,/g)?.length ?? 0) ? ";" : ",";
}

/** A statement date as a cafe day, or `null`. */
export function parseStatementDate(raw: string): string | null {
  const match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(toAsciiDigits(raw.trim()));
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year < 1700) {
    if (month < 1 || month > 12 || day < 1 || day > jalaliMonthLength(year, month)) return null;
    return fromJalali(year, month, day);
  }
  const iso = `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  return isCafeDay(iso) && new Date(`${iso}T00:00:00Z`).getUTCDate() === day ? iso : null;
}

/** A whole-Toman amount as a signed integer, or `null`; blank is 0. `-12`, `12-` and `(12)` are negative. */
export function parseStatementAmount(raw: string): number | null {
  let value = toAsciiDigits(raw.trim()).replace(/[\s,٬'’]/g, "");
  if (value === "") return 0;
  let negative = false;
  if (/^\(.*\)$/.test(value)) {
    negative = true;
    value = value.slice(1, -1);
  }
  if (value.startsWith("-")) {
    negative = !negative;
    value = value.slice(1);
  } else if (value.endsWith("-")) {
    negative = !negative;
    value = value.slice(0, -1);
  } else if (value.startsWith("+")) {
    value = value.slice(1);
  }
  if (!/^\d+$/.test(value)) return null;
  const amount = Number(value);
  return Number.isSafeInteger(amount) ? (negative ? -amount : amount) : null;
}

export function parseStatementCsv(text: string): ParsedStatement {
  const rows = text.split(/\r?\n/).filter((row) => row.trim() !== "");
  const delimiter = detectDelimiter(rows);
  const lines: StatementLineFormInput[] = [];
  const skippedRows: number[] = [];

  rows.forEach((row, index) => {
    const cells = splitRow(row, delimiter);
    const date = parseStatementDate(cells[0] ?? "");
    let amount: number | null = null;
    let reference = "";
    if (cells.length >= 5) {
      const withdrawal = parseStatementAmount(cells[2]);
      const deposit = parseStatementAmount(cells[3]);
      amount = withdrawal === null || deposit === null ? null : deposit - Math.abs(withdrawal);
      reference = cells[4];
    } else if (cells.length >= 3) {
      amount = parseStatementAmount(cells[2]);
      reference = cells[3] ?? "";
    }

    if (!date || amount === null || amount === 0) {
      // A header row is expected; anything else unreadable is reported.
      if (index > 0 || date) skippedRows.push(index + 1);
      return;
    }
    lines.push({
      date,
      description: (cells[1] || reference || "—").slice(0, 200),
      reference: reference.slice(0, 80),
      amount: String(amount),
    });
  });

  return { lines, skippedRows };
}
