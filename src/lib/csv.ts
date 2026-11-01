/**
 * CSV for spreadsheets (RFC 4180, CRLF line ends). Amounts stay numbers, so a
 * spreadsheet can add them up; only text is touched.
 */
export type CsvCell = string | number | undefined;

/** Excel reads a file without this as the ANSI code page, which garbles Persian. */
export const CSV_BOM = "﻿";

/**
 * What a spreadsheet runs as a formula when a cell starts with it. Descriptions and
 * memos are typed by staff or copied from guests, so text like `=HYPERLINK(...)`
 * must reach the accountant as text. The full-width forms count too.
 */
const FORMULA_START = /^[=+\-@\t\r\n＝＋－＠]/;

function csvCell(value: CsvCell): string {
  if (value === undefined) return "";
  if (typeof value === "number") return String(value);
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** One row, line end included. */
export function csvLine(cells: readonly CsvCell[]): string {
  return `${cells.map(csvCell).join(",")}\r\n`;
}

/** A whole file. */
export function toCsv(rows: readonly (readonly CsvCell[])[]): string {
  return CSV_BOM + rows.map(csvLine).join("");
}
