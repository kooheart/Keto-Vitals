import Link from "next/link";
import { Heart, PackageSearch, User, Truck, ShieldCheck, Leaf } from "lucide-react";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getCurrentUser } from "@/lib/auth/session";
import { SearchBox } from "./search-box";
import { CartBadge, LogoutButton, MobileMenu } from "./header-bits";
import { NewsletterForm } from "./newsletter-form";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="Keto Vitals home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-mark.svg" alt="" className={`h-9 w-9 ${light ? "brightness-0 invert" : ""}`} />
      <span className={`font-display text-xl font-bold tracking-tight sm:text-2xl ${light ? "text-white" : "text-brand-800"}`}>Keto <span className={light ? "text-gold-400" : "text-gold-600"}>Vitals</span></span>
    </Link>
  );
}

export async function Header() {
  const [settings, user, roots] = await Promise.all([
    getSettings(),
    getCurrentUser(),
    db.category.findMany({ where: { isActive: true, parentId: null }, orderBy: { sortOrder: "asc" }, select: { slug: true, name: true, children: { where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { slug: true, name: true } } } }),
  ]);
  const iconLink = "flex min-h-[44px] items-center gap-2 rounded-lg px-2.5 text-sm font-medium hover:bg-ink-100";
  return (
    <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/95 backdrop-blur">
      <a href="#main" className="sr-only-focusable absolute left-2 top-2 z-[110] rounded bg-white px-3 py-2 text-sm font-semibold shadow">Skip to content</a>
      {settings["announcement.text"] && (
        <div className="bg-brand-900 px-4 py-2 text-center text-xs font-medium text-brand-50 sm:text-sm" data-testid="announcement">{settings["announcement.text"]}</div>
      )}
      <div className="container-page flex items-center gap-3 py-3">
        <MobileMenu cats={roots} signedIn={!!user} />
        <Logo />
        <div className="mx-4 hidden max-w-2xl flex-1 lg:block"><SearchBox /></div>
        <nav aria-label="Account" className="ml-auto flex items-center gap-0.5">
          <Link href="/track" className={`${iconLink} hidden md:flex`}><PackageSearch className="h-6 w-6" aria-hidden /><span className="hidden xl:inline">Track order</span></Link>
          <Link href="/wishlist" className={iconLink} aria-label="Wishlist"><Heart className="h-6 w-6" aria-hidden /><span className="hidden xl:inline">Wishlist</span></Link>
          {user ? (
            <div className="group relative">
              <Link href="/account" className={iconLink}><User className="h-6 w-6" aria-hidden /><span className="hidden max-w-[7rem] truncate md:inline">{user.name.split(" ")[0]}</span></Link>
              <div className="invisible absolute right-0 top-full z-50 w-48 rounded-lg border border-ink-200 bg-white py-1 text-sm opacity-0 shadow-lg group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                <Link href="/account/orders" className="block px-4 py-2 hover:bg-ink-50">My orders</Link>
                <Link href="/account/addresses" className="block px-4 py-2 hover:bg-ink-50">Addresses</Link>
                <Link href="/account" className="block px-4 py-2 hover:bg-ink-50">Profile & security</Link>
                {user.permissions.length > 0 && <Link href="/admin" className="block px-4 py-2 font-medium text-brand-700 hover:bg-ink-50">Admin dashboard</Link>}
                <LogoutButton className="block w-full px-4 py-2 text-left hover:bg-ink-50" />
              </div>
            </div>
          ) : (
            <Link href="/login" className={iconLink}><User className="h-6 w-6" aria-hidden /><span className="hidden md:inline">Sign in</span></Link>
          )}
          <CartBadge />
        </nav>
      </div>
      <div className="container-page pb-3 lg:hidden"><SearchBox /></div>
      <nav aria-label="Categories" className="hidden border-t border-ink-100 bg-ink-50/60 lg:block">
        <ul className="container-page flex flex-wrap items-center gap-0 text-[13px] font-medium xl:gap-1 xl:text-sm">
          {roots.map((c) => (
            <li key={c.slug} className="group relative">
              <Link href={`/category/${c.slug}`} className="flex min-h-[44px] items-center whitespace-nowrap px-2 hover:text-brand-700 focus-visible:text-brand-700 xl:px-3">{c.name}</Link>
              {c.children.length > 0 && (
                <ul className="invisible absolute left-0 top-full z-50 min-w-56 rounded-b-lg border border-ink-200 bg-white py-1 opacity-0 shadow-lg group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                  <li><Link href={`/category/${c.slug}`} className="block px-4 py-2 font-semibold hover:bg-ink-50">All {c.name}</Link></li>
                  {c.children.map((k) => <li key={k.slug}><Link href={`/category/${k.slug}`} className="block px-4 py-2 font-normal hover:bg-ink-50">{k.name}</Link></li>)}
                </ul>
              )}
            </li>
          ))}
          <li><Link href="/search?sort=newest" className="flex min-h-[44px] items-center whitespace-nowrap px-2 hover:text-brand-700 xl:px-3">New arrivals</Link></li>
          <li><Link href="/search?minRating=0&sort=popular&inStock=1" className="flex min-h-[44px] items-center whitespace-nowrap px-2 hover:text-brand-700 xl:px-3">Best sellers</Link></li>
          <li><Link href="/collections/keto-starter-kit" className="flex min-h-[44px] items-center whitespace-nowrap px-2 text-gold-600 hover:text-gold-500 xl:px-3">Keto Starter Kit</Link></li>
        </ul>
      </nav>
    </header>
  );
}

const PAY = ["UPI", "Visa", "Mastercard", "RuPay", "Net Banking", "Wallets", "Cash on Delivery"];

export async function Footer() {
  const s = await getSettings();
  const roots = await db.category.findMany({ where: { isActive: true, parentId: null }, orderBy: { sortOrder: "asc" }, select: { slug: true, name: true }, take: 6 });
  const social = [["Instagram", s["social.instagram"]], ["Facebook", s["social.facebook"]], ["YouTube", s["social.youtube"]]].filter(([, u]) => u);
  const h = "mb-3 text-sm font-semibold uppercase tracking-wider text-gold-300";
  const a = "block py-1 text-sm text-brand-100 hover:text-white hover:underline";
  return (
    <footer className="mt-16 bg-brand-950 text-brand-100">
      <div className="border-b border-white/10">
        <div className="container-page grid gap-6 py-8 sm:grid-cols-3">
          {[[Truck, "Free shipping over ₹499", "Delivered across India"], [ShieldCheck, "Secure payments", "UPI, cards, net banking & COD"], [Leaf, "Quality you can check", "Ingredients listed on every product"]].map(([Icon, t, d]) => {
            const I = Icon as typeof Truck;
            return <div key={t as string} className="flex items-start gap-3"><I className="mt-0.5 h-6 w-6 text-gold-400" aria-hidden /><div><p className="font-semibold text-white">{t as string}</p><p className="text-sm text-brand-200">{d as string}</p></div></div>;
          })}
        </div>
      </div>
      <div className="container-page grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Logo light />
          <p className="mt-3 max-w-sm text-sm text-brand-200">{s["store.tagline"]}. Keto-friendly supplements, protein, exotic teas and snacks for weight management.</p>
          <h2 className="mb-2 mt-6 text-sm font-semibold text-white">Get offers & new arrivals</h2>
          <NewsletterForm compact />
        </div>
        <div><h2 className={h}>Shop</h2>{roots.map((c) => <Link key={c.slug} href={`/category/${c.slug}`} className={a}>{c.name}</Link>)}</div>
        <div><h2 className={h}>Customer service</h2>
          <Link href="/track" className={a}>Track your order</Link><Link href="/policies/shipping" className={a}>Shipping policy</Link><Link href="/policies/returns" className={a}>Returns & refunds</Link><Link href="/policies/faq" className={a}>FAQs</Link><Link href="/policies/contact" className={a}>Contact us</Link>
        </div>
        <div><h2 className={h}>Contact</h2>
          <p className="text-sm">{s["store.email"]}</p><p className="text-sm">{s["store.phone"]}</p><p className="mt-1 text-sm text-brand-200">{s["store.address"]}</p>
          {social.length > 0 && <div className="mt-3 flex gap-3">{social.map(([n, u]) => <a key={n as string} href={u as string} target="_blank" rel="noopener noreferrer" className="text-sm underline">{n as string}</a>)}</div>}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-4 py-6 text-xs text-brand-200 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2" aria-label="Accepted payment methods">{PAY.map((p) => <span key={p} className="rounded border border-white/20 px-2 py-1">{p}</span>)}</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1"><Link href="/policies/privacy" className="hover:underline">Privacy policy</Link><Link href="/policies/terms" className="hover:underline">Terms of service</Link><span>© {new Date().getFullYear()} {s["store.name"]}</span></div>
        </div>
        <p className="container-page pb-6 text-[11px] leading-relaxed text-brand-300">These statements have not been evaluated by any regulatory authority. Our products are dietary supplements and foods, not medicines, and are not intended to diagnose, treat, cure or prevent any disease. Results vary from person to person. Consult a healthcare professional before starting any supplement.</p>
      </div>
    </footer>
  );
}
