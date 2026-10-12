import { describe, expect, it } from "vitest";
import { parseQuery, toSearchParams } from "@/lib/catalog";

describe("shareable filter URLs", () => {
  it("round-trips filters and sorting", () => {
    const q = parseQuery({ q: "green tea", category: "exotic-teas", minPrice: "100", maxPrice: "900", inStock: "1", minRating: "4", tags: "vegan,sugar-free", sort: "price-asc", page: "3" });
    expect(q).toMatchObject({ q: "green tea", category: "exotic-teas", minPrice: 100, maxPrice: 900, inStock: true, minRating: 4, tags: ["vegan", "sugar-free"], sort: "price-asc", page: 3 });
    expect(parseQuery(Object.fromEntries(toSearchParams(q)))).toEqual(q);
  });
  it("ignores junk values", () => {
    const q = parseQuery({ sort: "hacked", minPrice: "-5", page: "abc", maxPrice: "x" });
    expect(q.sort).toBeUndefined();
    expect(q.minPrice).toBeUndefined();
    expect(q.maxPrice).toBeUndefined();
    expect(q.page).toBe(1);
  });
});
