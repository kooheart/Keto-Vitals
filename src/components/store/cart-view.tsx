"use client";
import Link from "next/link";
import { useState } from "react";
import { Minus, Plus, Trash2, ShoppingBag, Tag } from "lucide-react";
import { formatINR } from "@/lib/money";
import { useCart } from "./cart-provider";
import { ProductImage } from "@/components/ui/product-image";
import type { CartView } from "@/lib/cart";

export function Totals({ cart, shippingNote }: { cart: CartView; shippingNote?: string }) {
  const p = cart.pricing;
  const row = "flex justify-between py-1.5 text-sm";
  return (
    <dl>
      <div className={row}><dt>Subtotal ({cart.itemCount} item{cart.itemCount === 1 ? "" : "s"})</dt><dd>{formatINR(p.subtotalPaise)}</dd></div>
      {p.discountPaise > 0 && <div className={`${row} text-brand-700`}><dt>Discount{cart.coupon ? ` (${cart.coupon.code})` : ""}</dt><dd>−{formatINR(p.discountPaise)}</dd></div>}
      <div className={row}><dt>Shipping</dt><dd>{p.shippingPaise === 0 ? <span className="text-brand-700">Free</span> : formatINR(p.shippingPaise)}</dd></div>
      <div className="flex justify-between border-t border-ink-200 pt-3 text-base font-bold"><dt>Total</dt><dd data-testid="cart-total">{formatINR(p.totalPaise)}</dd></div>
      <p className="mt-1 text-xs text-ink-500">Includes {formatINR(p.taxPaise)} GST. {shippingNote ?? "Shipping is estimated; the final charge depends on your PIN code."}</p>
    </dl>
  );
}

export function CouponBox() {
  const { cart, applyCoupon, removeCoupon } = useCart();
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (cart?.coupon)
    return <div className="flex items-center justify-between rounded-lg bg-brand-50 px-3.5 py-2.5 text-sm"><span className="flex items-center gap-2"><Tag className="h-4 w-4 text-brand-700" aria-hidden /><strong>{cart.coupon.code}</strong> applied</span><button className="font-semibold text-brand-700 underline" onClick={() => removeCoupon()}>Remove</button></div>;
  return (
    <form onSubmit={async (e) => { e.preventDefault(); if (!code.trim()) return; setBusy(true); setErr(await applyCoupon(code)); setBusy(false); setCode(""); }}>
      <label htmlFor="coupon" className="label">Have a coupon?</label>
      <div className="flex gap-2"><input id="coupon" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Enter code" className="input uppercase" maxLength={40} aria-invalid={!!err || undefined} aria-describedby={err ? "coupon-err" : undefined} /><button className="btn-outline" disabled={busy}>Apply</button></div>
      {err && <p id="coupon-err" role="alert" className="field-error">{err}</p>}
      {cart?.couponError && !err && <p role="alert" className="field-error">{cart.couponError}</p>}
    </form>
  );
}

export function CartPageView() {
  const { cart, loading, setQty, remove } = useCart();
  if (loading) return <div className="container-page py-10"><div className="skeleton h-8 w-48" /><div className="skeleton mt-6 h-40 w-full" /></div>;
  if (!cart || cart.lines.length === 0)
    return (
      <div className="container-page py-20 text-center">
        <ShoppingBag className="mx-auto h-14 w-14 text-ink-300" aria-hidden />
        <h1 className="mt-4 font-display text-2xl font-bold">Your cart is empty</h1>
        <p className="mt-2 text-ink-600">Browse our best sellers and find something you’ll love.</p>
        <Link href="/search?sort=popular" className="btn-primary mt-6">Start shopping</Link>
      </div>
    );
  const remaining = cart.freeShippingThresholdPaise - (cart.pricing.subtotalPaise - cart.pricing.discountPaise);
  return (
    <div className="container-page py-8">
      <h1 className="font-display text-3xl font-bold">Shopping cart</h1>
      <div className="mt-6 grid gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2" aria-label="Cart items">
          {remaining > 0 ? <p className="mb-4 rounded-lg bg-gold-50 px-4 py-2.5 text-sm">Add <strong>{formatINR(remaining)}</strong> more for free shipping.</p> : <p className="mb-4 rounded-lg bg-brand-50 px-4 py-2.5 text-sm text-brand-800">You’ve unlocked free shipping 🎉</p>}
          <ul className="divide-y divide-ink-100 rounded-xl border border-ink-100">
            {cart.lines.map((l) => (
              <li key={l.variantId} className="flex gap-4 p-4" data-testid="cart-line">
                <Link href={`/product/${l.slug}`} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-ink-50"><ProductImage src={l.imageUrl} alt={l.imageAlt} sizes="96px" /></Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/product/${l.slug}`} className="font-semibold hover:text-brand-700">{l.name}</Link>
                  <p className="text-sm text-ink-500">{l.variantName}</p>
                  {l.issue && <p role="alert" className="mt-1 text-sm font-medium text-red-600">{l.issue}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    <div role="group" aria-label={`Quantity for ${l.name}`} className="inline-flex items-center rounded-lg border border-ink-300">
                      <button aria-label="Decrease quantity" className="flex h-10 w-10 items-center justify-center" onClick={() => setQty(l.variantId, l.quantity - 1)}><Minus className="h-4 w-4" /></button>
                      <output className="w-8 text-center text-sm font-semibold">{l.quantity}</output>
                      <button aria-label="Increase quantity" className="flex h-10 w-10 items-center justify-center disabled:opacity-40" disabled={l.quantity >= Math.min(10, l.stock)} onClick={() => setQty(l.variantId, l.quantity + 1)}><Plus className="h-4 w-4" /></button>
                    </div>
                    <button className="flex items-center gap-1 text-sm text-ink-600 hover:text-red-600" onClick={() => remove(l.variantId)}><Trash2 className="h-4 w-4" aria-hidden /> Remove</button>
                  </div>
                </div>
                <div className="text-right"><p className="font-bold">{formatINR(l.lineTotalPaise)}</p>{l.mrpPaise > l.unitPricePaise && <p className="text-xs text-ink-500 line-through">{formatINR(l.mrpPaise * l.quantity)}</p>}</div>
              </li>
            ))}
          </ul>
        </section>
        <aside className="card h-fit space-y-5 p-5 lg:sticky lg:top-40" aria-label="Order summary">
          <h2 className="font-semibold">Order summary</h2>
          <CouponBox />
          <Totals cart={cart} />
          {cart.hasIssues ? <p role="alert" className="text-sm text-red-600">Please fix the highlighted items to continue.</p> : <Link href="/checkout" className="btn-primary w-full" data-testid="checkout-link">Proceed to checkout</Link>}
          <Link href="/search" className="block text-center text-sm font-medium text-brand-700 hover:underline">Continue shopping</Link>
        </aside>
      </div>
    </div>
  );
}
