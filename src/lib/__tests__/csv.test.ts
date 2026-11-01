import { describe, expect, it } from "vitest";

import { CSV_BOM, csvLine, toCsv } from "../csv";

describe("csvLine", () => {
  it("joins cells and ends the line with CRLF", () => {
    expect(csvLine(["1110", "Cash", 5000])).toBe("1110,Cash,5000\r\n");
  });

  it("leaves a missing cell empty", () => {
    expect(csvLine([undefined, "Total", undefined])).toBe(",Total,\r\n");
  });

  it("quotes what would break the row", () => {
    expect(csvLine(['Milk, "full fat"'])).toBe('"Milk, ""full fat"""\r\n');
    expect(csvLine(["two\nlines"])).toBe('"two\nlines"\r\n');
  });

  it("keeps a negative amount a number", () => {
    expect(csvLine([-5000])).toBe("-5000\r\n");
  });

  it.each(['=HYPERLINK("http://evil.example","Open")', "+1+1", "-1+1", "@SUM(A1:A9)", "\t=1+1", "\r=1+1", "＝1+1"])(
    "defuses %j so a spreadsheet reads it as text",
    (text) => {
      expect(csvLine([text]).replace(/^"/, "")).toMatch(/^'/);
    },
  );

  it("leaves ordinary text alone, Persian included", () => {
    expect(csvLine(["Milk 2% - Mehr", "شیر"])).toBe("Milk 2% - Mehr,شیر\r\n");
  });
});

describe("toCsv", () => {
  it("starts with the BOM Excel needs to read Persian", () => {
    expect(toCsv([["a"], ["b"]])).toBe(`${CSV_BOM}a\r\nb\r\n`);
  });
});
