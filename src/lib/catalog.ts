import { Prisma } from "@prisma/client";
import { db } from "./db";

export const PAGE_SIZE = 12;

/** Prisma `contains` does not escape LIKE wildcards; do it so "%" and "_" are matched literally. */
export const escapeLike = (t: string) => t.replace(/[\\%_]/g, "\\$&");
export const SORTS = ["relevance", "popular", "newest", "price-asc", "price-desc", "rating"] as const;
export type Sort = (typeof SORTS)[number];

export type ProductQuery = {
  q?: string;
  category?: string; // slug (includes descendants)
  collection?: string; // slug
  minPrice?: number; // rupees
  maxPrice?: number; // rupees
  inStock?: boolean;
  minRating?: number;
  tags?: string[];
  form?: string;
  sort?: Sort;
  page?: number;
  pageSize?: number;
  /** include DRAFT/ARCHIVED (admin only) */
  includeInactive?: boolean;
};

/** Parse URL search params into a ProductQuery (and back via toSearchParams) so filters are shareable links. */
export function parseQuery(sp: Record<string, string | string[] | undefined>): ProductQuery {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined));
  const num = (k: string) => {
    const v = Number(one(k));
    return one(k) && Number.isFinite(v) && v >= 0 ? v : undefined;
  };
  const sort = one("sort") as Sort | undefined;
  const tags = (one("tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 8);
  return {
    q: one("q")?.trim().slice(0, 100) || undefined,
    category: one("category") || undefined,
    collection: one("collection") || undefined,
    minPrice: num("minPrice"),
    maxPrice: num("maxPrice"),
    inStock: one("inStock") === "1" || undefined,
    minRating: num("minRating"),
    tags: tags.length ? tags : undefined,
    form: one("form") || undefined,
    sort: sort && SORTS.includes(sort) ? sort : undefined,
    page: Math.max(1, Math.floor(num("page") ?? 1)),
  };
}

export function toSearchParams(q: ProductQuery): URLSearchParams {
  const p = new URLSearchParams();
  if (q.q) p.set("q", q.q);
  if (q.category) p.set("category", q.category);
  if (q.collection) p.set("collection", q.collection);
  if (q.minPrice != null) p.set("minPrice", String(q.minPrice));
  if (q.maxPrice != null) p.set("maxPrice", String(q.maxPrice));
  if (q.inStock) p.set("inStock", "1");
  if (q.minRating) p.set("minRating", String(q.minRating));
  if (q.tags?.length) p.set("tags", q.tags.join(","));
  if (q.form) p.set("form", q.form);
  if (q.sort && q.sort !== "relevance") p.set("sort", q.sort);
  if (q.page && q.page > 1) p.set("page", String(q.page));
  return p;
}

export const cardSelect = {
  id: true,
  slug: true,
  name: true,
  brand: true,
  form: true,
  minPricePaise: true,
  maxDiscountPct: true,
  inStock: true,
  ratingAvg: true,
  ratingCount: true,
  images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, alt: true } },
  variants: { where: { isActive: true }, orderBy: { pricePaise: "asc" }, take: 1, select: { id: true, pricePaise: true, mrpPaise: true } },
  _count: { select: { variants: { where: { isActive: true } } } },
} satisfies Prisma.ProductSelect;

export type ProductCard = Prisma.ProductGetPayload<{ select: typeof cardSelect }>;

async function categoryIds(slug: string): Promise<string[] | null> {
  const cat = await db.category.findUnique({ where: { slug }, select: { id: true, children: { select: { id: true } } } });
  return cat ? [cat.id, ...cat.children.map((c) => c.id)] : null;
}

export async function buildWhere(q: ProductQuery): Promise<Prisma.ProductWhereInput | null> {
  const and: Prisma.ProductWhereInput[] = [];
  if (!q.includeInactive) and.push({ status: "ACTIVE" });
  if (q.category) {
    const ids = await categoryIds(q.category);
    if (!ids) return null; // unknown category → no results
    and.push({ categoryId: { in: ids } });
  }
  if (q.collection) and.push({ collections: { some: { collection: { slug: q.collection, isActive: true } } } });
  if (q.q) {
    // Every term must match somewhere (name, brand, description, tags or category) — AND of ORs.
    for (const term of q.q.split(/\s+/).filter(Boolean).slice(0, 6)) {
      const c = { contains: escapeLike(term), mode: "insensitive" as const };
      and.push({ OR: [{ name: c }, { brand: c }, { description: c }, { shortDescription: c }, { form: c }, { tags: { has: term.toLowerCase() } }, { category: { name: c } }] });
    }
  }
  if (q.minPrice != null) and.push({ minPricePaise: { gte: Math.round(q.minPrice * 100) } });
  if (q.maxPrice != null) and.push({ minPricePaise: { lte: Math.round(q.maxPrice * 100) } });
  if (q.inStock) and.push({ inStock: true });
  if (q.minRating) and.push({ ratingAvg: { gte: q.minRating }, ratingCount: { gt: 0 } });
  if (q.tags?.length) and.push({ tags: { hasEvery: q.tags } });
  if (q.form) and.push({ form: { equals: q.form, mode: "insensitive" } });
  return { AND: and };
}

function orderBy(sort: Sort | undefined, hasQuery: boolean): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "price-asc": return [{ minPricePaise: "asc" }, { id: "asc" }];
    case "price-desc": return [{ minPricePaise: "desc" }, { id: "asc" }];
    case "newest": return [{ createdAt: "desc" }, { id: "asc" }];
    case "rating": return [{ ratingAvg: "desc" }, { ratingCount: "desc" }, { id: "asc" }];
    case "popular": return [{ soldCount: "desc" }, { id: "asc" }];
    default: return hasQuery ? [{ soldCount: "desc" }, { id: "asc" }] : [{ inStock: "desc" }, { soldCount: "desc" }, { id: "asc" }];
  }
}

export async function searchProducts(q: ProductQuery) {
  const pageSize = q.pageSize ?? PAGE_SIZE;
  const where = await buildWhere(q);
  if (!where) return { items: [] as ProductCard[], total: 0, page: 1, pages: 1, pageSize };
  const total = await db.product.count({ where });
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, q.page ?? 1), pages);
  const items = await db.product.findMany({
    where,
    select: cardSelect,
    orderBy: orderBy(q.sort, !!q.q),
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  return { items, total, page, pages, pageSize };
}

export async function suggest(term: string) {
  const t = term.trim().slice(0, 60);
  if (t.length < 2) return { products: [], categories: [] };
  const [products, categories] = await Promise.all([
    db.product.findMany({
      where: { status: "ACTIVE", OR: [{ name: { contains: escapeLike(t), mode: "insensitive" } }, { brand: { contains: escapeLike(t), mode: "insensitive" } }, { tags: { has: t.toLowerCase() } }] },
      select: { slug: true, name: true, minPricePaise: true, images: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true, alt: true } } },
      orderBy: { soldCount: "desc" },
      take: 6,
    }),
    db.category.findMany({ where: { isActive: true, name: { contains: escapeLike(t), mode: "insensitive" } }, select: { slug: true, name: true }, take: 3 }),
  ]);
  return { products, categories };
}

export async function getFacets() {
  const [tags, forms] = await Promise.all([
    db.$queryRaw<{ tag: string; n: bigint }[]>`SELECT t AS tag, count(*) AS n FROM "Product", unnest(tags) AS t WHERE status = 'ACTIVE' GROUP BY t ORDER BY n DESC, t LIMIT 20`,
    db.product.groupBy({ by: ["form"], where: { status: "ACTIVE", form: { not: null } }, _count: true, orderBy: { _count: { form: "desc" } } }),
  ]);
  return { tags: tags.map((t) => ({ value: t.tag, count: Number(t.n) })), forms: forms.map((f) => ({ value: f.form!, count: f._count })) };
}

/** Recompute denormalised sort/filter columns. Call after any variant, stock or review change. */
export async function syncProductDerived(productId: string, tx: Prisma.TransactionClient | typeof db = db) {
  const [variants, agg] = await Promise.all([
    tx.productVariant.findMany({ where: { productId, isActive: true }, include: { inventory: true } }),
    tx.review.aggregate({ where: { productId, status: "APPROVED" }, _avg: { rating: true }, _count: true }),
  ]);
  const minPrice = variants.length ? Math.min(...variants.map((v) => v.pricePaise)) : 0;
  const maxDiscount = variants.reduce((m, v) => Math.max(m, v.mrpPaise > v.pricePaise ? Math.round(((v.mrpPaise - v.pricePaise) / v.mrpPaise) * 100) : 0), 0);
  await tx.product.update({
    where: { id: productId },
    data: {
      minPricePaise: minPrice,
      maxDiscountPct: maxDiscount,
      inStock: variants.some((v) => (v.inventory?.quantity ?? 0) > 0),
      ratingAvg: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : 0,
      ratingCount: agg._count,
    },
  });
}

export async function getProductBySlug(slug: string) {
  return db.product.findFirst({
    where: { slug, status: "ACTIVE" },
    include: {
      category: { include: { parent: true } },
      images: { orderBy: { sortOrder: "asc" } },
      variants: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { pricePaise: "asc" }], include: { inventory: { select: { quantity: true } } } },
    },
  });
}

export async function getRelated(productId: string, categoryId: string, take = 4) {
  return db.product.findMany({
    where: { status: "ACTIVE", categoryId, id: { not: productId } },
    select: cardSelect,
    orderBy: [{ inStock: "desc" }, { soldCount: "desc" }],
    take,
  });
}

/** "Frequently bought together": products that co-occur in real orders; falls back to same category. */
export async function getFrequentlyBoughtWith(productId: string, categoryId: string, take = 3) {
  const rows = await db.$queryRaw<{ pid: string; n: bigint }[]>`
    SELECT b."productId" AS pid, count(*) AS n
    FROM "OrderItem" a JOIN "OrderItem" b ON a."orderId" = b."orderId" AND b."productId" <> a."productId"
    JOIN "Order" o ON o.id = a."orderId" AND o.status NOT IN ('CANCELLED','PENDING_PAYMENT')
    WHERE a."productId" = ${productId} AND b."productId" IS NOT NULL
    GROUP BY b."productId" ORDER BY n DESC LIMIT ${take}`;
  if (rows.length) {
    const items = await db.product.findMany({ where: { id: { in: rows.map((r) => r.pid) }, status: "ACTIVE" }, select: cardSelect });
    if (items.length) return items;
  }
  return getRelated(productId, categoryId, take);
}
