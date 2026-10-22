import { describe, expect, it } from "vitest";

import { CAFE_TABLE_LABELS, inFloorOrder, isCafeTable, isWholeFloor, seatsAtTables } from "../CafeTable";

describe("CafeTable", () => {
  it("knows the tables on the floor plan", () => {
    expect(isCafeTable("7")).toBe(true);
    expect(isCafeTable("long")).toBe(true);
    expect(isCafeTable("Table 7")).toBe(false);
  });

  it("adds up the seats at the given tables, ignoring unknown labels", () => {
    expect(seatsAtTables(["7", "8"])).toBe(14);
    expect(seatsAtTables(["7", "nope"])).toBe(6);
    expect(seatsAtTables([])).toBe(0);
  });

  it("orders tables as the floor is walked and drops duplicates and unknowns", () => {
    expect(inFloorOrder(["long", "8", "2", "8", "nope"])).toEqual(["2", "8", "long"]);
  });

  it("recognises the whole floor", () => {
    expect(isWholeFloor([...CAFE_TABLE_LABELS].reverse())).toBe(true);
    expect(isWholeFloor(CAFE_TABLE_LABELS.slice(1))).toBe(false);
  });
});
