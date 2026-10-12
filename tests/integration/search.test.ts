import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { searchProducts, suggest, syncProductDerived } from "@/lib/catalog";
import { makeCategory, makeProduct, resetDb } from "./helpers";

beforeEach(async () => {
  await resetDb();
  const teas = await makeCategory("teas");
  const green = await makeCategory("green-teas", teas.id);
  const supp = await makeCategory("supplements");
  await makeProduct({ name: "Darjeeling Green Tea", price: 400, categoryId: green.id, tags: ["vegan"], form: "Tea", sold: 50, description: "Whole leaf from the hills" });
  await makeProduct({ name: "Masala Chai", price: 300, categoryId: teas.id, tags: ["vegan", "sugar-free"], form: "Tea", sold: 10 });
  await makeProduct({ name: "Ketone Powder", price: 1900, categoryId: supp.id, tags: ["sugar-free"], form: "Powder", sold: 30, stock: 0 });
  await makeProduct({ name: "Hidden Draft", price: 100, categoryId: supp.id, status: "DRAFT" });
});

const names = async (q: Parameters<typeof searchProducts>[0]) => (await searchProducts(q)).items.map((i) => i.name);

describe("product search & filters", () => {
  it("never returns draft products", async () => expect((await searchProducts({})).total).toBe(3));

  it("matches by name, description and category name; every term must match", async () => {
    expect(await names({ q: "darjeeling" })).toEqual(["Darjeeling Green Tea"]);
    expect(await names({ q: "hills" })).toEqual(["Darjeeling Green Tea"]); // description
    expect(await names({ q: "green tea" })).toEqual(["Darjeeling Green Tea"]);
    expect(await names({ q: "darjeeling ketone" })).toEqual([]);
    expect(await names({ q: "TEAS" })).toHaveLength(2); // category-aware (child + parent names)
  });

  it("category filter includes child categories", async () => {
    expect(await names({ category: "teas" })).toHaveLength(2);
    expect(await names({ category: "green-teas" })).toEqual(["Darjeeling Green Tea"]);
    expect((await searchProducts({ category: "does-not-exist" })).total).toBe(0);
  });

  it("combines price, availability, tag, form and rating filters", async () => {
    expect(await names({ minPrice: 350 })).toHaveLength(2);
    expect(await names({ minPrice: 350, maxPrice: 1000 })).toEqual(["Darjeeling Green Tea"]);
    expect(await names({ inStock: true })).toHaveLength(2);
    expect(await names({ tags: ["vegan", "sugar-free"] })).toEqual(["Masala Chai"]);
    expect(await names({ form: "powder" })).toEqual(["Ketone Powder"]);
    expect(await names({ category: "teas", inStock: true, tags: ["vegan"], maxPrice: 350 })).toEqual(["Masala Chai"]);
  });

  it("sorts by price, popularity and newest", async () => {
    expect(await names({ sort: "price-asc" })).toEqual(["Masala Chai", "Darjeeling Green Tea", "Ketone Powder"]);
    expect(await names({ sort: "price-desc" })).toEqual(["Ketone Powder", "Darjeeling Green Tea", "Masala Chai"]);
    expect((await names({ sort: "popular" }))[0]).toBe("Darjeeling Green Tea");
    expect((await names({ sort: "newest" }))[0]).toBe("Ketone Powder");
  });

  it("filters and sorts by approved-review rating only", async () => {
    const chai = await db.product.findFirstOrThrow({ where: { name: "Masala Chai" } });
    const u = await db.user.create({ data: { email: "r@x.co", name: "R", passwordHash: "x", roleId: (await db.role.findFirstOrThrow()).id } });
    await db.review.create({ data: { productId: chai.id, userId: u.id, rating: 5, body: "Great stuff here", status: "APPROVED" } });
    await syncProductDerived(chai.id);
    expect(await names({ minRating: 4 })).toEqual(["Masala Chai"]);
    await db.review.updateMany({ data: { status: "REJECTED" } });
    await syncProductDerived(chai.id);
    expect(await names({ minRating: 4 })).toEqual([]);
  });

  it("paginates with correct totals and clamps out-of-range pages", async () => {
    const p1 = await searchProducts({ pageSize: 2, sort: "price-asc" });
    expect([p1.items.length, p1.total, p1.pages]).toEqual([2, 3, 2]);
    const p2 = await searchProducts({ pageSize: 2, sort: "price-asc", page: 2 });
    expect(p2.items).toHaveLength(1);
    expect((await searchProducts({ pageSize: 2, page: 99 })).page).toBe(2);
  });

  it("is safe against SQL-ish and wildcard input", async () => {
    expect((await searchProducts({ q: "'; DROP TABLE \"Product\"; --" })).total).toBe(0);
    expect((await searchProducts({})).total).toBe(3);
    expect((await searchProducts({ q: "%" })).total).toBe(0);
  });

  it("suggests products and categories", async () => {
    const s = await suggest("dar");
    expect(s.products.map((p) => p.name ?? "")).toBeDefined();
    expect((await suggest("tea")).categories.length).toBeGreaterThan(0);
    expect((await suggest("x")).products).toEqual([]);
  });
});
