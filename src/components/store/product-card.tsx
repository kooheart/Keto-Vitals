import Link from "next/link";
import type { ProductCard as Card } from "@/lib/catalog";
import { discountPct, formatINR } from "@/lib/money";
import { ProductImage } from "@/components/ui/product-image";
import { Stars } from "@/components/ui/stars";
import { WishlistButton } from "./wishlist-button";
import { QuickAdd } from "./quick-add";

export function ProductCard({ p, wishlisted = false, priority = false }: { p: Card; wishlisted?: boolean; priority?: boolean }) {
  const v = p.variants[0];
  const pct = v ? discountPct(v.mrpPaise, v.pricePaise) : 0;
  const multi = p._count.variants > 1;
  return (
    <article className="card group flex h-full flex-col overflow-hidden transition-shadow hover:shadow-lg" data-testid="product-card">
      <div className="relative aspect-square overflow-hidden bg-ink-50">
        <Link href={`/product/${p.slug}`} tabIndex={-1} aria-hidden className="block h-full w-full transition-transform duration-300 group-hover:scale-[1.03]">
          <ProductImage src={p.images[0]?.url} alt={p.images[0]?.alt ?? p.name} priority={priority} />
        </Link>
        {pct > 0 && p.inStock && <span className="absolute left-2 top-2 rounded bg-gold-400 px-2 py-0.5 text-xs font-bold text-ink-900">{pct}% off</span>}
        {!p.inStock && <span className="absolute left-2 top-2 rounded bg-ink-800 px-2 py-0.5 text-xs font-semibold text-white">Out of stock</span>}
        <div className="absolute right-2 top-2"><WishlistButton productId={p.id} initial={wishlisted} /></div>
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <p className="text-xs text-ink-500">{p.brand}{p.form ? ` · ${p.form}` : ""}</p>
        <h3 className="mt-0.5 line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-ink-900"><Link href={`/product/${p.slug}`} className="hover:text-brand-700 focus-visible:underline">{p.name}</Link></h3>
        <div className="mt-1.5"><Stars value={p.ratingAvg} count={p.ratingCount} /></div>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
          <span className="text-lg font-bold text-ink-900">{multi ? "From " : ""}{formatINR(p.minPricePaise)}</span>
          {pct > 0 && v && <span className="text-xs text-ink-500 line-through">{formatINR(v.mrpPaise)}</span>}
        </div>
        <p className="text-[11px] text-ink-500">Inclusive of all taxes</p>
        <div className="mt-3 pt-1 md:mt-auto">
          {p.inStock && v && !multi ? <QuickAdd variantId={v.id} name={p.name} /> : <Link href={`/product/${p.slug}`} className="btn-outline btn-sm w-full">{p.inStock ? "Select options" : "View details"}</Link>}
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ items, wishlist }: { items: Card[]; wishlist: Set<string> }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
      {items.map((p, i) => <li key={p.id}><ProductCard p={p} wishlisted={wishlist.has(p.id)} priority={i < 4} /></li>)}
    </ul>
  );
}

export function Section({ title, subtitle, href, hrefLabel = "View all", children }: { title: string; subtitle?: string; href?: string; hrefLabel?: string; children: React.ReactNode }) {
  return (
    <section className="container-page mt-12 sm:mt-16" aria-labelledby={`sec-${title.replace(/\W+/g, "-")}`}>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div><h2 id={`sec-${title.replace(/\W+/g, "-")}`} className="font-display text-2xl font-bold sm:text-3xl">{title}</h2>{subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}</div>
        {href && <Link href={href} className="shrink-0 text-sm font-semibold text-brand-700 hover:underline">{hrefLabel} →</Link>}
      </div>
      {children}
    </section>
  );
}
