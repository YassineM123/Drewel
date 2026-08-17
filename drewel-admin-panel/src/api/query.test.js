import { describe, expect, it } from "vitest";
import { compactParams, dateRangeParams, buildListParams, toPagination } from "./query";

describe("query helpers", () => {
  it("drops empty and \"all\" filter values", () => {
    expect(compactParams({ page: 2, search: "", status: "all", empty: null, missing: undefined })).toEqual({ page: 2 });
  });

  it("serializes date ranges and rejects inverted ranges", () => {
    expect(dateRangeParams({ from: "2024-01-01T00:00:00.000Z" })).toEqual({ from: "2024-01-01T00:00:00.000Z" });
    expect(() => dateRangeParams({ from: "2024-02-01", to: "2024-01-01" })).toThrow();
  });

  it("builds a consistent list params object", () => {
    const params = buildListParams({
      page: 3,
      limit: 10,
      sort: "createdAt",
      dir: "asc",
      search: "  driver  ",
      status: "approved",
      filters: { isRestricted: false },
      range: { from: "2024-01-01", to: "2024-01-31" },
    });
    expect(params).toMatchObject({
      page: 3,
      limit: 10,
      sort: "createdAt",
      dir: "asc",
      search: "driver",
      status: "approved",
      isRestricted: false,
      from: "2024-01-01",
      to: "2024-01-31",
    });
  });

  it("tolerates both pagination and meta envelopes", () => {
    expect(toPagination({ pagination: { page: 2, limit: 25, total: 100 } })).toEqual({
      page: 2, limit: 25, total: 100, totalPages: 4,
    });
    expect(toPagination({ meta: { currentPage: 1, perPage: 50, totalItems: 10 } })).toEqual({
      page: 1, limit: 50, total: 10, totalPages: 1,
    });
    expect(toPagination({})).toEqual({ page: 1, limit: 20, total: 0, totalPages: 1 });
  });
});