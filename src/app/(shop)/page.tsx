import Link from "next/link";
import type { Metadata } from "next";
import { Truck, ShieldCheck, Leaf, RotateCcw } from "lucide-react";
import { db } from "@/lib/db";
import { cardSelect } from "@/lib/catalog";
import { getWishlistIds } from "@/lib/wishlist";
import { Hero } from "@/components/store/hero";
import { ProductGrid, Section } from "@/components/store/product-card";
import { Stars } from "@/components/ui/stars";
import { NewsletterForm } from "@/components/store/newsletter-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function Home() {
  const active = { status: "ACTIVE" as const };
  const [banners, cats, best, fresh, offers, collections, reviews, wishlist] = await Promise.all([
    db.banner.findMany({ where: { isActive: true, placement: { in: ["HERO", "MID"] } }, orderBy: { sortOrder: "asc" } }),
    db.category.findMany({ where: { isActive: true, parentId: null }, orderBy: { sortOrder: "asc" }, take: 8 }),
    db.product.findMany({ where: active, select: cardSelect, orderBy: [{ inStock: "desc" }, { soldCount: "desc" }], take: 8 }),
    db.product.findMany({ where: active, select: cardSelect, orderBy: { createdAt: "desc" }, take: 4 }),
    db.product.findMany({ where: { ...active, inStock: true, maxDiscountPct: { gt: 0 } }, select: cardSelect, orderBy: { maxDiscountPct: "desc" }, take: 4 }),
    db.collection.findMany({ where: { isActive: true, isFeatured: true }, orderBy: { sortOrder: "asc" }, take: 3 }),
    db.review.findMany({ where: { status: "APPROVED", rating: { gte: 4 } }, orderBy: { createdAt: "desc" }, take: 3, include: { user: { select: { name: true } }, product: { select: { name: true, slug: true } } } }),
    getWishlistIds(),
  ]);
  const hero = banners.filter((b) => b.placement === "HERO");
  const mid = banners.filter((b) => b.placement === "MID");
  const theme = (t: string) => (t === "gold" ? "bg-gold-100 text-ink-900" : t === "dark" ? "bg-brand-900 text-white" : "bg-brand-50 text-ink-900");

  return (
    <>
      <Hero slides={hero} />

      <Section title="Shop by category" subtitle="Everything for your weight-management routine">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {cats.map((c) => (
            <li key={c.id}>
              <Link href={`/category/${c.slug}`} className="card group block overflow-hidden text-center transition-shadow hover:shadow-lg">
                <div className="aspect-square overflow-hidden bg-ink-50">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={c.imageUrl ?? ""} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" /></div>
                <span className="block px-2 py-3 text-sm font-semibold">{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Best sellers" subtitle="Most-ordered by our customers" href="/search?sort=popular">
        <ProductGrid items={best} wishlist={wishlist} />
      </Section>

      {mid[0] && <PromoBanner b={mid[0]} cls={theme(mid[0].theme)} />}

      <Section title="New arrivals" href="/search?sort=newest">
        <ProductGrid items={fresh} wishlist={wishlist} />
      </Section>

      {offers.length > 0 && (
        <Section title="Special offers" subtitle="Reduced prices — while stocks last" href="/search?inStock=1&sort=popular">
          <ProductGrid items={offers} wishlist={wishlist} />
        </Section>
      )}

      {collections.length > 0 && (
        <Section title="Featured collections" subtitle="Curated by our team">
          <ul className="grid gap-4 md:grid-cols-3">
            {collections.map((c) => (
              <li key={c.id}>
                <Link href={`/collections/${c.slug}`} className="card group relative block overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.imageUrl ?? ""} alt="" loading="lazy" className="aspect-[3/2] w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 pt-12 text-white">
                    <h3 className="font-display text-xl font-bold text-white">{c.name}</h3>
                    <p className="line-clamp-2 text-sm text-white/85">{c.description}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {mid[1] && <PromoBanner b={mid[1]} cls={theme(mid[1].theme)} />}

      {reviews.length > 0 ? (
        <Section title="What customers are saying" subtitle="Approved reviews from our shoppers">
          <ul className="grid gap-4 md:grid-cols-3">
            {reviews.map((r) => (
              <li key={r.id} className="card p-5">
                <Stars value={r.rating} count={1} />
                {r.title && <p className="mt-2 font-semibold">{r.title}</p>}
                <p className="mt-1 text-sm text-ink-700">“{r.body.slice(0, 220)}”</p>
                <p className="mt-3 text-xs text-ink-500">{r.user.name.split(" ")[0]} on <Link className="underline" href={`/product/${r.product.slug}`}>{r.product.name}</Link>{r.verifiedPurchase && <span className="chip ml-2">Verified purchase</span>}</p>
              </li>
            ))}
          </ul>
        </Section>
      ) : (
        <Section title="Why shop with Keto Vitals">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[[Leaf, "Ingredients up front", "Every product page lists what’s inside and how to use it."], [Truck, "Fast, tracked delivery", "Free shipping above ₹499, with live order tracking."], [ShieldCheck, "Secure checkout", "Pay by UPI, card or net banking via Razorpay — or Cash on Delivery."], [RotateCcw, "Easy returns", "See our returns policy for eligible items and timelines."]].map(([I, t, d]) => {
              const Icon = I as typeof Leaf;
              return <li key={t as string} className="card p-5"><Icon className="h-7 w-7 text-brand-600" aria-hidden /><h3 className="mt-3 font-semibold">{t as string}</h3><p className="mt-1 text-sm text-ink-600">{d as string}</p></li>;
            })}
          </ul>
          <p className="mt-3 text-sm text-ink-500">Bought something? Customer reviews appear here once they’ve been approved.</p>
        </Section>
      )}

      <section className="container-page mt-12 sm:mt-16" aria-labelledby="nl-h">
        <div className="rounded-2xl bg-brand-50 px-6 py-10 text-center sm:px-12">
          <h2 id="nl-h" className="font-display text-2xl font-bold sm:text-3xl">Join the Keto Vitals list</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-600">New arrivals, recipes and offers — no spam, unsubscribe any time.</p>
          <div className="mx-auto mt-5 max-w-md text-left"><NewsletterForm /></div>
        </div>
      </section>
    </>
  );
}

function PromoBanner({ b, cls }: { b: { eyebrow: string | null; title: string; subtitle: string | null; ctaLabel: string | null; linkUrl: string | null; imageUrl: string | null }; cls: string }) {
  return (
    <section className="container-page mt-12 sm:mt-16" aria-label={b.title}>
      <div className={`grid items-center overflow-hidden rounded-2xl md:grid-cols-2 ${cls}`}>
        <div className="p-7 sm:p-10">
          {b.eyebrow && <p className="text-xs font-bold uppercase tracking-wider opacity-80">{b.eyebrow}</p>}
          <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl" style={{ color: "inherit" }}>{b.title}</h2>
          {b.subtitle && <p className="mt-2 max-w-md text-sm opacity-90 sm:text-base">{b.subtitle}</p>}
          {b.linkUrl && <Link href={b.linkUrl} className="btn-primary mt-5">{b.ctaLabel ?? "Learn more"}</Link>}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {b.imageUrl && <img src={b.imageUrl} alt="" loading="lazy" className="h-full max-h-64 w-full object-cover md:max-h-none" />}
      </div>
    </section>
  );
}
