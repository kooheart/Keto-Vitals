import { CheckCircle2, Clock } from "lucide-react";
import type { Order, OrderItem, OrderEvent } from "@prisma/client";
import { formatINR } from "@/lib/money";
import { STATUS_LABEL } from "@/lib/order-status";
import { ProductImage } from "@/components/ui/product-image";

type Full = Order & { items: OrderItem[]; events: OrderEvent[] };

export function OrderDetails({ o }: { o: Full }) {
  const a = o.shippingAddress as Record<string, string>;
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <section className="space-y-6 md:col-span-2" aria-label="Items">
        <ul className="divide-y divide-ink-100 rounded-xl border border-ink-100">
          {o.items.map((i) => (
            <li key={i.id} className="flex gap-4 p-4">
              <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded bg-ink-50"><ProductImage src={i.imageUrl} alt="" sizes="64px" /></span>
              <div className="min-w-0 flex-1"><p className="font-medium">{i.name}</p><p className="text-sm text-ink-500">{i.variantName} × {i.quantity}</p></div>
              <p className="font-semibold">{formatINR(i.lineTotalPaise)}</p>
            </li>
          ))}
        </ul>
        <div>
          <h3 className="mb-3 font-semibold">Order progress</h3>
          <ol className="space-y-3 border-l-2 border-brand-200 pl-5">
            {o.events.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-brand-600" />
                <p className="text-sm font-medium">{STATUS_LABEL[e.status]}</p>
                <p className="text-xs text-ink-500">{e.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}{e.note ? ` · ${e.note}` : ""}</p>
              </li>
            ))}
          </ol>
          {o.trackingNumber && <p className="mt-4 rounded-lg bg-ink-50 p-3 text-sm">Carrier: <strong>{o.carrier ?? "—"}</strong> · Tracking no.: <strong>{o.trackingNumber}</strong></p>}
        </div>
      </section>
      <aside className="space-y-5">
        <div className="card p-5 text-sm">
          <h3 className="mb-2 font-semibold">Payment summary</h3>
          <dl className="space-y-1">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatINR(o.subtotalPaise)}</dd></div>
            {o.discountPaise > 0 && <div className="flex justify-between text-brand-700"><dt>Discount {o.couponCode ? `(${o.couponCode})` : ""}</dt><dd>−{formatINR(o.discountPaise)}</dd></div>}
            <div className="flex justify-between"><dt>Shipping</dt><dd>{o.shippingPaise ? formatINR(o.shippingPaise) : "Free"}</dd></div>
            {o.codFeePaise > 0 && <div className="flex justify-between"><dt>COD fee</dt><dd>{formatINR(o.codFeePaise)}</dd></div>}
            <div className="flex justify-between border-t border-ink-200 pt-2 text-base font-bold"><dt>Total</dt><dd>{formatINR(o.totalPaise)}</dd></div>
          </dl>
          <p className="mt-2 text-xs text-ink-500">{o.paymentMethod === "COD" ? "Cash on Delivery" : "Online payment"} · {o.paymentStatus === "PAID" ? "Paid" : o.paymentStatus === "COD_PENDING" ? "Pay on delivery" : o.paymentStatus.toLowerCase()}</p>
        </div>
        <div className="card p-5 text-sm">
          <h3 className="mb-2 font-semibold">Shipping to</h3>
          <address className="not-italic text-ink-700">{a.fullName}<br />{a.line1}{a.line2 ? `, ${a.line2}` : ""}<br />{a.city}, {a.state} {a.pincode}<br />{a.phone}</address>
        </div>
      </aside>
    </div>
  );
}

export function OrderBanner({ o, pending }: { o: Order; pending?: boolean }) {
  if (o.status === "PENDING_PAYMENT")
    return <div className="flex items-start gap-3 rounded-xl bg-gold-50 p-5"><Clock className="mt-0.5 h-6 w-6 text-gold-600" aria-hidden /><div><h1 className="font-display text-2xl font-bold">Payment pending</h1><p className="text-ink-700">{pending ? "We haven’t received confirmation of your payment yet. If you were charged, this page will update shortly; otherwise you can retry below. " : ""}We’re holding your items for a short time. Order <strong>{o.number}</strong>.</p></div></div>;
  if (o.status === "CANCELLED") return <div className="rounded-xl bg-red-50 p-5"><h1 className="font-display text-2xl font-bold">Order cancelled</h1><p className="text-ink-700">Order {o.number} was cancelled{o.cancelReason ? `: ${o.cancelReason}` : ""}.</p></div>;
  return <div className="flex items-start gap-3 rounded-xl bg-brand-50 p-5"><CheckCircle2 className="mt-0.5 h-7 w-7 text-brand-600" aria-hidden /><div><h1 className="font-display text-2xl font-bold">{o.status === "PLACED" ? "Thank you — your order is confirmed!" : `Order ${STATUS_LABEL[o.status].toLowerCase()}`}</h1><p className="text-ink-700">Order number <strong data-testid="order-number">{o.number}</strong>. A confirmation has been sent to {o.email} if email delivery is configured.</p></div></div>;
}
