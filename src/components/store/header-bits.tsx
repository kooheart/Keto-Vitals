"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, ShoppingCart, X, ChevronDown } from "lucide-react";
import { useCart } from "./cart-provider";
import { api } from "@/components/ui/form";

export function CartBadge() {
  const { count } = useCart();
  return (
    <Link href="/cart" className="relative flex min-h-[44px] items-center gap-2 rounded-lg px-2.5 text-sm font-medium hover:bg-ink-100" aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}>
      <ShoppingCart className="h-6 w-6" aria-hidden />
      <span className="hidden sm:inline">Cart</span>
      {count > 0 && <span className="absolute -right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-400 px-1 text-[11px] font-bold text-ink-900 sm:static sm:-ml-1" data-testid="cart-count">{count}</span>}
    </Link>
  );
}

export function LogoutButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  return (
    <button className={className} onClick={async () => { await api("/api/auth/logout", "POST"); router.push("/"); router.refresh(); }}>Sign out</button>
  );
}

type Cat = { slug: string; name: string; children: { slug: string; name: string }[] };

export function MobileMenu({ cats, signedIn }: { cats: Cat[]; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [exp, setExp] = useState<string | null>(null);
  return (
    <>
      <button className="btn-ghost -ml-2 px-2 lg:hidden" aria-label="Open menu" aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen(true)}><Menu className="h-6 w-6" /></button>
      {open && (
        <div className="fixed inset-0 z-[90] lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <nav id="mobile-menu" className="absolute inset-y-0 left-0 w-[85%] max-w-sm overflow-y-auto bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between"><span className="font-display text-lg font-bold text-brand-800">Shop</span><button aria-label="Close menu" className="btn-ghost px-2" onClick={() => setOpen(false)}><X className="h-6 w-6" /></button></div>
            <ul className="divide-y divide-ink-100">
              {cats.map((c) => (
                <li key={c.slug}>
                  <div className="flex items-center">
                    <Link href={`/category/${c.slug}`} onClick={() => setOpen(false)} className="flex-1 py-3 font-medium">{c.name}</Link>
                    {c.children.length > 0 && <button aria-label={`Toggle ${c.name} subcategories`} aria-expanded={exp === c.slug} onClick={() => setExp(exp === c.slug ? null : c.slug)} className="p-3"><ChevronDown className={`h-4 w-4 transition-transform ${exp === c.slug ? "rotate-180" : ""}`} /></button>}
                  </div>
                  {exp === c.slug && <ul className="pb-2 pl-4">{c.children.map((k) => <li key={k.slug}><Link href={`/category/${k.slug}`} onClick={() => setOpen(false)} className="block py-2 text-sm text-ink-600">{k.name}</Link></li>)}</ul>}
                </li>
              ))}
              <li><Link href="/search?sort=newest" onClick={() => setOpen(false)} className="block py-3 font-medium">New arrivals</Link></li>
              <li><Link href="/track" onClick={() => setOpen(false)} className="block py-3 font-medium">Track order</Link></li>
              <li><Link href={signedIn ? "/account" : "/login"} onClick={() => setOpen(false)} className="block py-3 font-medium">{signedIn ? "My account" : "Sign in / Register"}</Link></li>
            </ul>
          </nav>
        </div>
      )}
    </>
  );
}
