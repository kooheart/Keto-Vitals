import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { db } from "@/lib/db";
import { getFacets, searchProducts, toSearchParams, type ProductQuery } from "@/lib/catalog";
import { getWishlistIds } from "@/lib/wishlist";
import { Filters } from "./filters";
import { ProductGrid } from "./product-card";

/** Shared by /category/[slug], /search and /collections/[slug]. */
export async function Listing({ q, basePath, hidden, title, subtitle, children }: { q: ProductQuery; basePath: string; hidden: Record<string, string>; title: string; subtitle?: string; children?: React.ReactNode }) {
  const [res, facets, wishlist] = await Promise.all([searchProducts(q), getFacets(), getWishlistIds()]);
  const href = (page: number) => { const p = toSearchParams({ ...q, page }); const s = p.toString(); return s ? `${basePath}?${s}` : basePath; };
  const active: { label: string; remove: ProductQuery }[] = [];
  if (q.minPrice != null) active.push({ label: `Min ₹${q.minPrice}`, remove: { ...q, minPrice: undefined } });
  if (q.maxPrice != null) active.push({ label: `Max ₹${q.maxPrice}`, remove: { ...q, maxPrice: undefined } });
  if (q.inStock) active.push({ label: "In stock", remove: { ...q, inStock: undefined } });
  if (q.minRating) active.push({ label: `${q.minRating}★ & up`, remove: { ...q, minRating: undefined } });
  if (q.form) active.push({ label: q.form, remove: { ...q, form: undefined } });
  for (const t of q.tags ?? []) active.push({ label: t.replace(/-/g, " "), remove: { ...q, tags: q.tags!.filter((x) => x !== t) } });
  const rm = (r: ProductQuery) => { const s = toSearchParams({ ...r, page: 1 }).toString(); return s ? `${basePath}?${s}` : basePath; };

  const popular = res.total === 0 ? await db.category.findMany({ where: { isActive: true, parentId: null }, orderBy: { sortOrder: "asc" }, take: 6, select: { slug: true, name: true } }) : [];

  return (
    <div className="container-page pb-8">
      <div className="mb-5">
        <h1 className="font-display text-3xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-ink-600">{subtitle}</p>}
        {children}
      </div>
      <div className="flex flex-col gap-6 lg:flex-row">
        <Filters q={q} facets={facets} hiddenParams={hidden} />
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="text-sm text-ink-600" aria-live="polite" data-testid="result-count">{res.total} {res.total === 1 ? "product" : "products"}{q.q ? <> for “<strong>{q.q}</strong>”</> : null}</p>
            {active.map((a) => <Link key={a.label} href={rm(a.remove)} className="chip gap-1 hover:bg-brand-100" aria-label={`Remove filter ${a.label}`}>{a.label} <span aria-hidden>×</span></Link>)}
          </div>
          {res.total > 0 ? (
            <>
              <ProductGrid items={res.items} wishlist={wishlist} />
              {res.pages > 1 && (
                <nav aria-label="Pagination" className="mt-8 flex flex-wrap items-center justify-center gap-2">
                  {res.page > 1 && <Link href={href(res.page - 1)} rel="prev" className="btn-outline btn-sm">← Previous</Link>}
                  {Array.from({ length: res.pages }, (_, i) => i + 1).map((n) => <Link key={n} href={href(n)} aria-current={n === res.page ? "page" : undefined} className={`btn btn-sm min-w-9 ${n === res.page ? "bg-brand-700 text-white" : "border border-ink-200 hover:bg-ink-50"}`}>{n}</Link>)}
                  {res.page < res.pages && <Link href={href(res.page + 1)} rel="next" className="btn-outline btn-sm">Next →</Link>}
                </nav>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-ink-300 bg-ink-50 px-6 py-14 text-center" data-testid="empty-state">
              <PackageSearch className="mx-auto h-10 w-10 text-ink-400" aria-hidden />
              <h2 className="mt-3 text-lg font-semibold">No products match{q.q ? ` “${q.q}”` : " your filters"}</h2>
              <ul className="mx-auto mt-3 max-w-sm list-disc pl-5 text-left text-sm text-ink-600"><li>Check the spelling or try a more general word</li><li>Remove some filters or widen the price range</li></ul>
              <div className="mt-5 flex flex-wrap justify-center gap-2">{active.length > 0 && <Link href={q.q ? `${basePath}?q=${encodeURIComponent(q.q)}` : basePath} className="btn-primary btn-sm">Clear filters</Link>}{popular.map((c) => <Link key={c.slug} href={`/category/${c.slug}`} className="btn-outline btn-sm">{c.name}</Link>)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
