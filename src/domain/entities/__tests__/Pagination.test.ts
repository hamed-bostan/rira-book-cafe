import { describe, expect, it } from "vitest";

import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  clampPageRequest,
  createPage,
  emptyPage,
  pageCount,
  paginateArray,
  toSkipTake,
} from "../Pagination";

describe("paging", () => {
  it("never reports zero pages", () => {
    expect(pageCount(0, 25)).toBe(1);
    expect(pageCount(51, 25)).toBe(3);
    expect(pageCount(10, 0)).toBe(1);
  });

  it.each<[{ page: number; pageSize: number }, { page: number; pageSize: number }]>([
    [
      { page: 0, pageSize: 10 },
      { page: 1, pageSize: 10 },
    ],
    [
      { page: 2.7, pageSize: 10.9 },
      { page: 2, pageSize: 10 },
    ],
    [
      { page: Number.NaN, pageSize: Number.NaN },
      { page: 1, pageSize: DEFAULT_PAGE_SIZE },
    ],
    [
      { page: 3, pageSize: 100_000 },
      { page: 3, pageSize: MAX_PAGE_SIZE },
    ],
    [
      { page: -4, pageSize: -1 },
      { page: 1, pageSize: 1 },
    ],
  ])("clamps %o to %o", (request, expected) => {
    expect(clampPageRequest(request)).toEqual(expected);
  });

  it("keeps the sort when clamping and turns a request into skip/take", () => {
    expect(clampPageRequest({ page: 1, pageSize: 10, sort: "name", direction: "asc" })).toEqual({
      page: 1,
      pageSize: 10,
      sort: "name",
      direction: "asc",
    });
    expect(toSkipTake({ page: 3, pageSize: 20 })).toEqual({ skip: 40, take: 20 });
  });

  it("assembles pages, empty ones, and pages of an in-memory list", () => {
    expect(createPage(["a"], 7, { page: 0, pageSize: 5 })).toEqual({ items: ["a"], total: 7, page: 1, pageSize: 5 });
    expect(emptyPage({ page: 2, pageSize: 5 })).toEqual({ items: [], total: 0, page: 2, pageSize: 5 });
    expect(paginateArray([1, 2, 3, 4, 5], { page: 2, pageSize: 2 })).toEqual({
      items: [3, 4],
      total: 5,
      page: 2,
      pageSize: 2,
    });
  });
});
