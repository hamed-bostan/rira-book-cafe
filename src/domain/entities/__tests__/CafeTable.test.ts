import { describe, expect, it } from "vitest";

import { activeFloor, inFloorOrder, isFloorTable, isTableSeats, isWholeFloor, seatsAtTables } from "../CafeTable";

import { FLOOR_TABLES } from "./floorFixture";

const FLOOR = activeFloor(FLOOR_TABLES);

describe("CafeTable", () => {
  it("knows the tables on the floor by label", () => {
    expect(isFloorTable(FLOOR, "7")).toBe(true);
    expect(isFloorTable(FLOOR, "long")).toBe(true);
    expect(isFloorTable(FLOOR, "Table 7")).toBe(false);
  });

  it("adds up the seats at a set of tables, ignoring unknown labels", () => {
    expect(seatsAtTables(FLOOR, ["7", "8"])).toBe(14);
    expect(seatsAtTables(FLOOR, ["7", "nope"])).toBe(6);
    expect(seatsAtTables(FLOOR, [])).toBe(0);
  });

  it("puts tables in floor order without duplicates or unknown labels", () => {
    expect(inFloorOrder(FLOOR, ["long", "8", "2", "8", "nope"])).toEqual(["2", "8", "long"]);
  });

  it("recognises the whole floor in any order", () => {
    const labels = FLOOR.map((table) => table.label);
    expect(isWholeFloor(FLOOR, [...labels].reverse())).toBe(true);
    expect(isWholeFloor(FLOOR, labels.slice(1))).toBe(false);
    expect(isWholeFloor([], [])).toBe(false);
  });

  it("offers only the tables in use, in floor order", () => {
    const floor = activeFloor([
      { id: "b", label: "B", seats: 2, isActive: true, position: 1, area: "Window" },
      { id: "a", label: "A", seats: 4, isActive: true, position: 0 },
      { id: "c", label: "C", seats: 6, isActive: false, position: 2 },
    ]);
    expect(floor).toEqual([
      { label: "A", seats: 4 },
      { label: "B", seats: 2, area: "Window" },
    ]);
  });

  it("allows 1 to 40 whole seats", () => {
    expect(isTableSeats(1)).toBe(true);
    expect(isTableSeats(40)).toBe(true);
    expect(isTableSeats(0)).toBe(false);
    expect(isTableSeats(41)).toBe(false);
    expect(isTableSeats(2.5)).toBe(false);
  });
});
