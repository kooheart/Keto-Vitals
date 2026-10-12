import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/session";
import { formatINR } from "@/lib/money";
import { STATUS_LABEL } from "@/lib/order-status";
import { Panel, Stat, Table, td } from "@/components/admin/ui";

const REVENUE = ["PLACED", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

export default async function Dashboard() {
  await requireAdminPage("dashboard.view");
  const since = new Date(Date.now() - 30 * 864e5);
  const [rev, rev30, orders, pending, customers, products, lowStock, recent] = await Promise.all([
    db.order.aggregate({ _sum: { totalPaise: true }, where: { status: { in: [...REVENUE] } } }),
    db.order.aggregate({ _sum: { totalPaise: true }, _count: true, where: { status: { in: [...REVENUE] }, createdAt: { gte: since } } }),
    db.order.count(),
    db.order.count({ where: { status: { in: ["PLACED", "PROCESSING"] } } }),
    db.user.count({ where: { role: { name: "customer" } } }),
    db.product.count({ where: { status: "ACTIVE" } }),
    db.inventory.findMany({ where: { variant: { isActive: true, product: { status: "ACTIVE" } } }, include: { variant: { include: { product: { select: { name: true } } } } }, orderBy: { quantity: "asc" }, take: 40 }),
    db.order.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const low = lowStock.filter((i) => i.quantity <= i.lowStockThreshold).slice(0, 8);
  return (
    <>
      <h1 className="mb-6 font-display text-2xl font-bold">Overview</h1>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total sales (confirmed orders)" value={formatINR(rev._sum.totalPaise ?? 0)} sub={`${formatINR(rev30._sum.totalPaise ?? 0)} in the last 30 days`} />
        <Stat label="Orders" value={String(orders)} sub={`${pending} awaiting fulfilment`} />
        <Stat label="Customers" value={String(customers)} />
        <Stat label="Active products" value={String(products)} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Recent orders" actions={<Link href="/admin/orders" className="text-sm text-brand-700 underline">All orders</Link>}>
          <Table head={["Order", "Status", "Total"]}>{recent.map((o) => <tr key={o.id}><td className={td}><Link className="font-medium text-brand-700 underline" href={`/admin/orders/${o.id}`}>{o.number}</Link></td><td className={td}>{STATUS_LABEL[o.status]}</td><td className={td}>{formatINR(o.totalPaise)}</td></tr>)}</Table>
          {recent.length === 0 && <p className="mt-3 text-sm text-ink-500">No orders yet.</p>}
        </Panel>
        <Panel title="Low stock" actions={<Link href="/admin/inventory" className="text-sm text-brand-700 underline">Inventory</Link>}>
          {low.length === 0 ? <p className="text-sm text-ink-500">Nothing is running low.</p> : <Table head={["Product", "Left"]}>{low.map((i) => <tr key={i.id}><td className={td}>{i.variant.product.name} <span className="text-ink-500">({i.variant.name})</span></td><td className={`${td} font-semibold ${i.quantity === 0 ? "text-red-600" : ""}`}>{i.quantity}</td></tr>)}</Table>}
        </Panel>
      </div>
    </>
  );
}
