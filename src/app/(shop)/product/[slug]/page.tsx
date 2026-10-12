import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RotateCcw, Truck, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { getFrequentlyBoughtWith, getProductBySlug, getRelated } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";
import { getWishlistIds } from "@/lib/wishlist";
import { getCurrentUser } from "@/lib/auth/session";
import { formatINR } from "@/lib/money";
import { BuyBox } from "@/components/store/buy-box";
import { ProductGallery } from "@/components/store/product-gallery";
import { ProductGrid } from "@/components/store/product-card";
import { Breadcrumbs, breadcrumbLd } from "@/components/store/breadcrumbs";
import { Stars } from "@/components/ui/stars";
import { ReviewForm } from "@/components/store/review-form";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };
const base = () => process.env.APP_URL ?? "http://localhost:3000";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProductBySlug((await params).slug);
  if (!p) return { title: "Product not found" };
  const desc = p.seoDescription ?? p.shortDescription ?? p.description.slice(0, 155);
  return {
    title: p.seoTitle ?? p.name,
    description: desc,
    alternates: { canonical: `/product/${p.slug}` },
    openGraph: { type: "website", title: p.name, description: desc, url: `/product/${p.slug}`, images: p.images.slice(0, 1).map((i) => ({ url: i.url, alt: i.alt })) },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) notFound();
  const [user, settings, wishlist, related, together, reviews] = await Promise.all([
    getCurrentUser(),
    getSettings(),
    getWishlistIds(),
    getRelated(p.id, p.categoryId, 4),
    getFrequentlyBoughtWith(p.id, p.categoryId, 3),
    db.review.findMany({ where: { productId: p.id, status: "APPROVED" }, orderBy: { createdAt: "desc" }, take: 20, include: { user: { select: { name: true } } } }),
  ]);
  const variants = p.variants.map((v) => ({ id: v.id, name: v.name, sku: v.sku, attributes: v.attributes as Record<string, string>, mrpPaise: v.mrpPaise, pricePaise: v.pricePaise, stock: v.inventory?.quantity ?? 0 }));
  const crumbs = [...(p.category.parent ? [{ label: p.category.parent.name, href: `/category/${p.category.parent.slug}` }] : []), { label: p.category.name, href: `/category/${p.category.slug}` }, { label: p.name }];
  const specs = Object.entries((p.specs ?? {}) as Record<string, string>);

  // Schema.org Product markup — only real data: no ratings unless approved reviews exist.
  const ld = {
    "@context": "https://schema.org", "@type": "Product", name: p.name, description: p.shortDescription ?? p.description.slice(0, 300),
    image: p.images.map((i) => base() + i.url), brand: { "@type": "Brand", name: p.brand }, sku: variants[0]?.sku,
    offers: variants.map((v) => ({ "@type": "Offer", sku: v.sku, price: (v.pricePaise / 100).toFixed(2), priceCurrency: "INR", availability: v.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: `${base()}/product/${p.slug}`, itemCondition: "https://schema.org/NewCondition" })),
    ...(p.ratingCount > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: p.ratingAvg, reviewCount: p.ratingCount } } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd(crumbs, base())).replace(/</g, "\\u003c") }} />
      <Breadcrumbs items={crumbs} />
      <div className="container-page grid gap-8 pb-8 lg:grid-cols-2 lg:gap-12">
        <ProductGallery images={p.images.map((i) => ({ url: i.url, alt: i.alt }))} name={p.name} />
        <div>
          <p className="text-sm text-ink-500">{p.brand}</p>
          <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">{p.name}</h1>
          <a href="#reviews" className="mt-2 inline-block"><Stars value={p.ratingAvg} count={p.ratingCount} /></a>
          {p.shortDescription && <p className="mt-3 text-ink-700">{p.shortDescription}</p>}
          <div className="mt-5 border-t border-ink-100 pt-5">
            <BuyBox productId={p.id} name={p.name} variants={variants} wishlisted={wishlist.has(p.id)} freeThresholdPaise={settings["shipping.freeThresholdPaise"]} />
          </div>
          <ul className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
            {[[Truck, "Tracked delivery", `Free over ${formatINR(settings["shipping.freeThresholdPaise"])}`], [RotateCcw, "Returns", "See returns policy"], [ShieldCheck, "Secure payment", "UPI, cards, COD"]].map(([I, t, d]) => { const Icon = I as typeof Truck; return <li key={t as string} className="flex items-start gap-2 rounded-lg bg-ink-50 p-3"><Icon className="mt-0.5 h-5 w-5 text-brand-700" aria-hidden /><span><strong className="block">{t as string}</strong><span className="text-ink-600">{d as string}</span></span></li>; })}
          </ul>
        </div>
      </div>

      <div className="container-page grid gap-10 lg:grid-cols-3">
        <section className="lg:col-span-2" aria-labelledby="desc-h">
          <h2 id="desc-h" className="font-display text-xl font-bold">About this product</h2>
          <p className="mt-3 whitespace-pre-line leading-relaxed text-ink-700">{p.description}</p>
          {p.features.length > 0 && <><h3 className="mt-6 font-semibold">Key features</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-ink-700">{p.features.map((f) => <li key={f}>{f}</li>)}</ul></>}
          <h3 className="mt-8 font-display text-lg font-bold">Shipping & returns</h3>
          <p className="mt-2 text-sm text-ink-700">Orders are shipped within 1–2 business days. Delivery estimates depend on your PIN code (use the checker above). Cash on Delivery is available in most areas. For eligibility and timelines see our <Link href="/policies/returns" className="font-medium text-brand-700 underline">returns policy</Link> and <Link href="/policies/shipping" className="font-medium text-brand-700 underline">shipping policy</Link>.</p>
        </section>
        {specs.length > 0 && (
          <section aria-labelledby="spec-h">
            <h2 id="spec-h" className="font-display text-xl font-bold">Specifications</h2>
            <dl className="mt-3 divide-y divide-ink-100 rounded-xl border border-ink-100 text-sm">
              {specs.map(([k, v]) => <div key={k} className="grid grid-cols-5 gap-2 px-4 py-2.5"><dt className="col-span-2 text-ink-500">{k}</dt><dd className="col-span-3 font-medium">{v}</dd></div>)}
              <div className="grid grid-cols-5 gap-2 px-4 py-2.5"><dt className="col-span-2 text-ink-500">GST</dt><dd className="col-span-3 font-medium">{p.gstRate}% (included)</dd></div>
            </dl>
          </section>
        )}
      </div>

      <section id="reviews" className="container-page mt-12 grid gap-8 lg:grid-cols-3" aria-labelledby="rev-h">
        <div className="lg:col-span-2">
          <h2 id="rev-h" className="font-display text-xl font-bold">Customer reviews</h2>
          {reviews.length === 0 ? <p className="mt-3 text-ink-600">No reviews yet — be the first to share your experience.</p> : (
            <ul className="mt-4 space-y-5">
              {reviews.map((r) => (
                <li key={r.id} className="border-b border-ink-100 pb-5">
                  <div className="flex flex-wrap items-center gap-2"><Stars value={r.rating} count={1} /><span className="text-sm font-semibold">{r.title}</span>{r.verifiedPurchase && <span className="chip">Verified purchase</span>}</div>
                  <p className="mt-1.5 text-sm text-ink-700">{r.body}</p>
                  <p className="mt-1 text-xs text-ink-500">{r.user.name.split(" ")[0]} · {r.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card p-5"><h3 className="mb-3 font-semibold">Write a review</h3><ReviewForm productId={p.id} signedIn={!!user} /></div>
      </section>

      {together.length > 0 && <section className="container-page mt-12" aria-labelledby="fbt-h"><h2 id="fbt-h" className="mb-4 font-display text-xl font-bold">Frequently bought together</h2><ProductGrid items={together} wishlist={wishlist} /></section>}
      {related.length > 0 && <section className="container-page mt-12" aria-labelledby="rel-h"><h2 id="rel-h" className="mb-4 font-display text-xl font-bold">You may also like</h2><ProductGrid items={related} wishlist={wishlist} /></section>}
    </>
  );
}
