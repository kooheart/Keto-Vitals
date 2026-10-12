"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Truck, MapPin } from "lucide-react";
import { discountPct, formatINR } from "@/lib/money";
import { useCart } from "./cart-provider";
import { WishlistButton } from "./wishlist-button";
import { api, ApiFail } from "@/components/ui/form";

export type BuyVariant = { id: string; name: string; sku: string; attributes: Record<string, string>; mrpPaise: number; pricePaise: number; stock: number };

export function BuyBox({ productId, name, variants, wishlisted, freeThresholdPaise }: { productId: string; name: string; variants: BuyVariant[]; wishlisted: boolean; freeThresholdPaise: number }) {
  const [vid, setVid] = useState((variants.find((v) => v.stock > 0) ?? variants[0]).id);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const { add } = useCart();
  const router = useRouter();
  const v = variants.find((x) => x.id === vid)!;
  const pct = discountPct(v.mrpPaise, v.pricePaise);
  const max = Math.min(10, v.stock);
  const keys = useMemo(() => Array.from(new Set(variants.flatMap((x) => Object.keys(x.attributes)))), [variants]);

  const [pin, setPin] = useState("");
  const [pinRes, setPinRes] = useState<{ ok: boolean; text: string } | null>(null);
  async function checkPin(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await api<any>(`/api/pincode?pin=${pin}`, "GET");
      setPinRes(r.serviceable ? { ok: true, text: `Delivery by ${r.eta} · ${r.ratePaise === 0 ? "free" : formatINR(r.ratePaise)} shipping (free above ${formatINR(freeThresholdPaise)})${r.codAvailable ? " · Cash on Delivery available" : ""}${r.city ? ` · ${r.city}, ${r.state}` : ""}` } : { ok: false, text: r.reason });
    } catch (err) { setPinRes({ ok: false, text: err instanceof ApiFail ? err.message : "Could not check this PIN code." }); }
  }

  async function addToCart() { setBusy(true); await add(v.id, qty, name); setBusy(false); }
  async function buyNow() { setBusy(true); const ok = await add(v.id, qty); setBusy(false); if (ok) router.push("/checkout"); }

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-3" data-testid="price-block">
        <span className="text-3xl font-bold text-ink-900" data-testid="price">{formatINR(v.pricePaise)}</span>
        {pct > 0 && <><span className="text-lg text-ink-500 line-through">{formatINR(v.mrpPaise)}</span><span className="rounded bg-gold-100 px-2 py-0.5 text-sm font-bold text-gold-600">{pct}% off</span></>}
      </div>
      <p className="mt-0.5 text-xs text-ink-500">MRP inclusive of all taxes</p>

      {keys.map((k) => {
        const opts = variants.filter((x) => x.attributes[k]);
        return (
          <fieldset key={k} className="mt-5">
            <legend className="label">{k}: <span className="font-normal text-ink-600">{v.attributes[k]}</span></legend>
            <div className="flex flex-wrap gap-2">
              {opts.map((o) => (
                <button key={o.id} type="button" onClick={() => { setVid(o.id); setQty(1); }} aria-pressed={o.id === vid}
                  className={`min-h-[44px] rounded-lg border px-4 py-2 text-sm ${o.id === vid ? "border-brand-700 bg-brand-50 font-semibold text-brand-900 ring-1 ring-brand-700" : "border-ink-300 hover:border-ink-500"} ${o.stock < 1 ? "text-ink-400 line-through" : ""}`}>
                  {o.attributes[k]}{o.stock < 1 && <span className="sr-only"> (out of stock)</span>}
                </button>
              ))}
            </div>
          </fieldset>
        );
      })}

      <p className="mt-4 text-sm font-medium" data-testid="stock">
        {v.stock < 1 ? <span className="text-red-600">Out of stock</span> : v.stock <= 5 ? <span className="text-gold-600">Only {v.stock} left in stock</span> : <span className="text-brand-700">In stock</span>}
      </p>

      {v.stock > 0 && (
        <div className="mt-4 flex items-center gap-3">
          <span className="label mb-0" id="qty-l">Quantity</span>
          <div role="group" aria-labelledby="qty-l" className="inline-flex items-center rounded-lg border border-ink-300">
            <button type="button" aria-label="Decrease quantity" onClick={() => setQty(Math.max(1, qty - 1))} disabled={qty <= 1} className="flex h-11 w-11 items-center justify-center disabled:opacity-40"><Minus className="h-4 w-4" /></button>
            <output aria-live="polite" className="w-10 text-center text-sm font-semibold" data-testid="qty">{qty}</output>
            <button type="button" aria-label="Increase quantity" onClick={() => setQty(Math.min(max, qty + 1))} disabled={qty >= max} className="flex h-11 w-11 items-center justify-center disabled:opacity-40"><Plus className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button className="btn-outline" disabled={busy || v.stock < 1} onClick={addToCart} data-testid="add-to-cart">{busy ? "Adding…" : "Add to cart"}</button>
        <button className="btn-primary" disabled={busy || v.stock < 1} onClick={buyNow} data-testid="buy-now">Buy now</button>
      </div>
      <div className="mt-3"><WishlistButton productId={productId} initial={wishlisted} variant="full" /></div>

      <form onSubmit={checkPin} className="mt-6 rounded-xl border border-ink-100 bg-ink-50 p-4">
        <label htmlFor="pin" className="label flex items-center gap-1.5"><MapPin className="h-4 w-4" aria-hidden /> Check delivery to your PIN code</label>
        <div className="flex gap-2"><input id="pin" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setPinRes(null); }} placeholder="6-digit PIN code" className="input max-w-[11rem]" /><button className="btn-outline" disabled={pin.length !== 6}>Check</button></div>
        {pinRes && <p role="status" className={`mt-2 flex items-start gap-1.5 text-sm ${pinRes.ok ? "text-brand-800" : "text-red-600"}`}>{pinRes.ok && <Truck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}{pinRes.text}</p>}
      </form>
    </div>
  );
}
