"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatINR } from "@/lib/money";
import { INDIAN_STATES } from "@/lib/shipping";
import { api, ApiFail, Field, FormError } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { useCart } from "./cart-provider";
import { CouponBox } from "./cart-view";
import { ProductImage } from "@/components/ui/product-image";
import { openRazorpay } from "./razorpay-client";
import type { PricingResult } from "@/lib/pricing";

type Saved = { id: string; fullName: string; phone: string; line1: string; line2: string | null; landmark: string | null; city: string; state: string; pincode: string };
type Quote = { pricing: PricingResult; service: any; methods: { razorpay: boolean; cod: boolean; codFeePaise: number; codMaxPaise: number } };

export function CheckoutForm({ user, saved }: { user: { email: string; name: string; phone: string | null } | null; saved: Saved[] }) {
  const { cart, loading, refresh } = useCart();
  const router = useRouter();
  const { toast } = useToast();
  const key = useRef(`co-${crypto.randomUUID()}`); // one key per checkout session → double-click safe
  const [f, setF] = useState({ email: user?.email ?? "", phone: user?.phone ?? "", fullName: user?.name ?? "", line1: "", line2: "", landmark: "", city: "", state: "", pincode: "" });
  const [method, setMethod] = useState<"RAZORPAY" | "COD">("RAZORPAY");
  const [saveAddr, setSaveAddr] = useState(true);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formErr, setFormErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  const pinOk = /^[1-9]\d{5}$/.test(f.pincode);
  useEffect(() => {
    if (loading) return;
    const ctl = new AbortController();
    (async () => {
      try {
        const q = await api<Quote>(`/api/checkout/quote?pin=${pinOk ? f.pincode : ""}&cod=${method === "COD" ? 1 : 0}`, "GET");
        setQuote(q);
        if (q.service?.serviceable) setF((x) => ({ ...x, city: x.city || q.service.city || "", state: x.state || q.service.state || "" }));
        if (method === "COD" && !q.methods.cod) setMethod("RAZORPAY");
        if (method === "RAZORPAY" && !q.methods.razorpay && q.methods.cod) setMethod("COD");
      } catch { /* ignore */ }
    })();
    return () => ctl.abort();
  }, [f.pincode, pinOk, method, loading, cart?.coupon?.code, cart?.itemCount]);

  if (loading) return <div className="container-page py-10"><div className="skeleton h-96 w-full" /></div>;
  if (!cart || cart.lines.length === 0) return <div className="container-page py-20 text-center"><h1 className="font-display text-2xl font-bold">Your cart is empty</h1><Link href="/search" className="btn-primary mt-5">Continue shopping</Link></div>;

  function fillSaved(id: string) {
    const a = saved.find((s) => s.id === id);
    if (a) setF((x) => ({ ...x, fullName: a.fullName, phone: a.phone, line1: a.line1, line2: a.line2 ?? "", landmark: a.landmark ?? "", city: a.city, state: a.state, pincode: a.pincode }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErrors({}); setFormErr("");
    try {
      const r = await api<{ number: string; token: string; orderId: string; razorpay?: { keyId: string; razorpayOrderId: string; amountPaise: number } }>("/api/checkout/place", "POST", {
        idempotencyKey: key.current, email: f.email, phone: f.phone, paymentMethod: method, saveAddress: !!user && saveAddr,
        address: { fullName: f.fullName, phone: f.phone, line1: f.line1, line2: f.line2, landmark: f.landmark, city: f.city, state: f.state, pincode: f.pincode },
      });
      const go = (extra = "") => { router.push(`/order/${r.number}?t=${r.token}${extra}`); };
      if (!r.razorpay) { void refresh(); return go(); }
      void refresh();
      await openRazorpay({
        keyId: r.razorpay.keyId, orderId: r.razorpay.razorpayOrderId, amountPaise: r.razorpay.amountPaise, name: "Keto Vitals", description: `Order ${r.number}`, prefill: { name: f.fullName, email: f.email, contact: f.phone },
        onSuccess: async (resp) => {
          try {
            await api("/api/checkout/verify", "POST", resp);
            go();
          } catch (err) {
            toast({ kind: "error", message: err instanceof ApiFail ? err.message : "We couldn’t confirm your payment yet." });
            go("&pending=1");
          }
        },
        onDismiss: () => { toast({ kind: "error", message: "Payment not completed. You can retry from your order page." }); go("&pending=1"); },
        onFailed: (msg) => toast({ kind: "error", message: msg }),
      });
    } catch (err) {
      if (err instanceof ApiFail) {
        setErrors(Object.fromEntries(Object.entries(err.fieldErrors).map(([k, v]) => [k.replace(/^address\./, ""), v])));
        setFormErr(err.message);
        if (err.code === "stock_changed" || err.code === "empty_cart") void refresh();
      } else setFormErr("Something went wrong. Please try again.");
    } finally { setBusy(false); }
  }

  const q = quote;
  const pr = q?.pricing ?? cart.pricing;
  const svc = q?.service;
  return (
    <form onSubmit={submit} noValidate className="container-page grid gap-8 py-8 lg:grid-cols-3">
      <div className="space-y-8 lg:col-span-2">
        <h1 className="font-display text-3xl font-bold lg:col-span-3">Checkout</h1>
        <FormError message={formErr} />
        {!user && <p className="rounded-lg bg-ink-50 px-4 py-3 text-sm">Checking out as a guest. <Link href="/login?next=/checkout" className="font-semibold text-brand-700 underline">Sign in</Link> to use saved addresses and track orders in your account.</p>}
        <fieldset className="space-y-4">
          <legend className="mb-1 text-lg font-semibold">1. Contact</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" error={errors.email}>{(p) => <input {...p} type="email" autoComplete="email" className="input" value={f.email} onChange={set("email")} />}</Field>
            <Field label="Mobile number" error={errors.phone} hint="10-digit Indian mobile number">{(p) => <input {...p} type="tel" inputMode="numeric" autoComplete="tel-national" className="input" value={f.phone} onChange={set("phone")} />}</Field>
          </div>
        </fieldset>
        <fieldset className="space-y-4">
          <legend className="mb-1 text-lg font-semibold">2. Shipping address</legend>
          {saved.length > 0 && <div><label htmlFor="saved" className="label">Use a saved address</label><select id="saved" className="input" defaultValue="" onChange={(e) => fillSaved(e.target.value)}><option value="">Enter a new address</option>{saved.map((a) => <option key={a.id} value={a.id}>{a.fullName} — {a.line1}, {a.city} {a.pincode}</option>)}</select></div>}
          <Field label="Full name" error={errors.fullName}>{(p) => <input {...p} autoComplete="name" className="input" value={f.fullName} onChange={set("fullName")} />}</Field>
          <Field label="Address (house no., street)" error={errors.line1}>{(p) => <input {...p} autoComplete="address-line1" className="input" value={f.line1} onChange={set("line1")} />}</Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Apartment, area (optional)" error={errors.line2}>{(p) => <input {...p} autoComplete="address-line2" className="input" value={f.line2} onChange={set("line2")} />}</Field>
            <Field label="Landmark (optional)" error={errors.landmark}>{(p) => <input {...p} className="input" value={f.landmark} onChange={set("landmark")} />}</Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="PIN code" error={errors.pincode ?? (svc && !svc.serviceable ? svc.reason : undefined)}>{(p) => <input {...p} inputMode="numeric" maxLength={6} autoComplete="postal-code" className="input" value={f.pincode} onChange={(e) => setF((x) => ({ ...x, pincode: e.target.value.replace(/\D/g, "") }))} />}</Field>
            <Field label="City" error={errors.city}>{(p) => <input {...p} autoComplete="address-level2" className="input" value={f.city} onChange={set("city")} />}</Field>
            <Field label="State" error={errors.state}>{(p) => <select {...p} autoComplete="address-level1" className="input" value={f.state} onChange={set("state")}><option value="">Select state</option>{INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}</select>}</Field>
          </div>
          {svc?.serviceable && <p role="status" className="text-sm text-brand-800">✓ We deliver to {f.pincode} · {svc.etaMinDays}–{svc.etaMaxDays} days</p>}
          {user && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={saveAddr} onChange={(e) => setSaveAddr(e.target.checked)} className="h-4 w-4 accent-brand-700" /> Save this address to my account</label>}
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="mb-1 text-lg font-semibold">3. Payment</legend>
          {q && !q.methods.razorpay && !q.methods.cod && <p role="alert" className="text-sm text-red-600">{pinOk ? "No payment method is available for this order." : "Enter your PIN code to see available payment methods."}</p>}
          <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${method === "RAZORPAY" ? "border-brand-700 bg-brand-50" : "border-ink-200"} ${q && !q.methods.razorpay ? "opacity-50" : ""}`}>
            <input type="radio" name="pm" checked={method === "RAZORPAY"} disabled={!!q && !q.methods.razorpay} onChange={() => setMethod("RAZORPAY")} className="mt-1 accent-brand-700" />
            <span><strong>Pay online</strong><span className="block text-sm text-ink-600">UPI, cards, net banking, wallets — securely via Razorpay{q && !q.methods.razorpay ? " (currently unavailable)" : ""}</span></span>
          </label>
          <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${method === "COD" ? "border-brand-700 bg-brand-50" : "border-ink-200"} ${q && !q.methods.cod ? "opacity-50" : ""}`}>
            <input type="radio" name="pm" checked={method === "COD"} disabled={!q || !q.methods.cod} onChange={() => setMethod("COD")} className="mt-1 accent-brand-700" />
            <span><strong>Cash on Delivery</strong><span className="block text-sm text-ink-600">Pay when your order arrives · {formatINR(q?.methods.codFeePaise ?? 0)} handling fee · orders up to {formatINR(q?.methods.codMaxPaise ?? 0)}{q && !q.methods.cod && pinOk ? " · not available for this order/PIN" : ""}</span></span>
          </label>
        </fieldset>
      </div>

      <aside className="card h-fit space-y-4 p-5 lg:sticky lg:top-40" aria-label="Order summary">
        <h2 className="font-semibold">Order summary</h2>
        <ul className="max-h-56 divide-y divide-ink-100 overflow-auto">
          {cart.lines.map((l) => <li key={l.variantId} className="flex items-center gap-3 py-2 text-sm"><span className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-ink-50"><ProductImage src={l.imageUrl} alt="" sizes="48px" /></span><span className="min-w-0 flex-1"><span className="line-clamp-1 font-medium">{l.name}</span><span className="text-xs text-ink-500">{l.variantName} × {l.quantity}</span></span><span>{formatINR(l.lineTotalPaise)}</span></li>)}
        </ul>
        <CouponBox />
        <dl className="text-sm">
          <div className="flex justify-between py-1"><dt>Subtotal</dt><dd>{formatINR(pr.subtotalPaise)}</dd></div>
          {pr.discountPaise > 0 && <div className="flex justify-between py-1 text-brand-700"><dt>Discount</dt><dd>−{formatINR(pr.discountPaise)}</dd></div>}
          <div className="flex justify-between py-1"><dt>Shipping</dt><dd>{pr.shippingPaise === 0 ? "Free" : formatINR(pr.shippingPaise)}</dd></div>
          {pr.codFeePaise > 0 && <div className="flex justify-between py-1"><dt>COD fee</dt><dd>{formatINR(pr.codFeePaise)}</dd></div>}
          <div className="mt-2 flex justify-between border-t border-ink-200 pt-3 text-base font-bold"><dt>Total</dt><dd data-testid="checkout-total">{formatINR(pr.totalPaise)}</dd></div>
          <p className="mt-1 text-xs text-ink-500">Includes {formatINR(pr.taxPaise)} GST{pinOk ? "" : " · shipping shown is an estimate until you enter your PIN code"}</p>
        </dl>
        <button className="btn-primary w-full" disabled={busy || cart.hasIssues || (!!q && !q.methods.razorpay && !q.methods.cod)} data-testid="place-order">{busy ? "Placing order…" : method === "COD" ? `Place order · ${formatINR(pr.totalPaise)}` : `Pay ${formatINR(pr.totalPaise)}`}</button>
        {cart.hasIssues && <p role="alert" className="text-sm text-red-600">Some items need attention — <Link href="/cart" className="underline">review your cart</Link>.</p>}
        <p className="text-center text-xs text-ink-500">By placing your order you agree to our <Link href="/policies/terms" className="underline">terms</Link> and <Link href="/policies/privacy" className="underline">privacy policy</Link>.</p>
      </aside>
    </form>
  );
}
