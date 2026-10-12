import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { validOrderToken, orderAccessToken } from "@/lib/order-access";
import { OrderBanner, OrderDetails } from "@/components/store/order-view";
import { PayNow } from "@/components/store/pay-now";

export const metadata: Metadata = { title: "Order confirmation", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function OrderPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ t?: string; pending?: string }> }) {
  const [{ number }, sp, user] = await Promise.all([params, searchParams, getCurrentUser()]);
  const o = await db.order.findUnique({ where: { number }, include: { items: true, events: { orderBy: { createdAt: "asc" } } } });
  // Authorised if: signed-in owner, or holder of the signed link token. Otherwise indistinguishable from "not found".
  if (!o || !((user && o.userId === user.id) || validOrderToken(number, sp.t))) notFound();
  return (
    <div className="container-page max-w-4xl space-y-6 py-8">
      <OrderBanner o={o} pending={!!sp.pending} />
      {o.status === "PENDING_PAYMENT" && <PayNow orderId={o.id} email={o.email} number={o.number} token={orderAccessToken(o.number)} />}
      <OrderDetails o={o} />
      <div className="flex gap-3"><Link href="/search" className="btn-primary">Continue shopping</Link>{user && <Link href="/account/orders" className="btn-outline">My orders</Link>}</div>
    </div>
  );
}
