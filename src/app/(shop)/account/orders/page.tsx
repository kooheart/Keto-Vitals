import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUserPage } from "@/lib/auth/session";
import { formatINR } from "@/lib/money";
import { STATUS_LABEL } from "@/lib/order-status";

export const metadata: Metadata = { title: "My orders", robots: { index: false } };

export default async function OrdersPage() {
  const u = await requireUserPage("/account");
  const orders = await db.order.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 50, include: { _count: { select: { items: true } } } });
  return (
    <div>
      <h1 className="font-display text-2xl font-bold">My orders</h1>
      {orders.length === 0 ? <p className="mt-4 text-ink-600">No orders yet. <Link href="/search" className="font-semibold text-brand-700 underline">Start shopping</Link></p> : (
        <ul className="mt-5 divide-y divide-ink-100 rounded-xl border border-ink-100">
          {orders.map((o) => (
            <li key={o.id}><Link href={`/account/orders/${o.number}`} className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-ink-50"><span><strong>{o.number}</strong><span className="block text-xs text-ink-500">{o.createdAt.toLocaleDateString("en-IN", { dateStyle: "medium" })} · {o._count.items} item(s)</span></span><span className="chip">{STATUS_LABEL[o.status]}</span><span className="font-semibold">{formatINR(o.totalPaise)}</span></Link></li>
          ))}
        </ul>
      )}
    </div>
  );
}
