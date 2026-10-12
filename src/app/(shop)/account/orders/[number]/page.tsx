import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUserPage } from "@/lib/auth/session";
import { OrderBanner, OrderDetails } from "@/components/store/order-view";
import { PayNow } from "@/components/store/pay-now";
import { orderAccessToken } from "@/lib/order-access";

export const metadata: Metadata = { title: "Order details", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ number: string }> }) {
  const u = await requireUserPage("/account");
  const o = await db.order.findFirst({ where: { number: (await params).number, userId: u.id }, include: { items: true, events: { orderBy: { createdAt: "asc" } } } }); // scoped to owner
  if (!o) notFound();
  return <div className="space-y-6"><OrderBanner o={o} />{o.status === "PENDING_PAYMENT" && <PayNow orderId={o.id} email={o.email} number={o.number} token={orderAccessToken(o.number)} />}<OrderDetails o={o} /></div>;
}
