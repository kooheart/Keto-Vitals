import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/session";
import { formatINR } from "@/lib/money";
import { Panel, Stat, Table, td } from "@/components/admin/ui";

export default async function Reports({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requireAdminPage("reports.view");
  const sp = await searchParams;
  const valid = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);
  const to = valid(sp.to) ?? new Date().toISOString().slice(0, 10);
  const from = valid(sp.from) ?? new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
  const range = { gte: new Date(`${from}T00:00:00.000Z`), lt: new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 864e5) };
  const counted = ["PLACED", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

  const [agg, byDay, top, byMethod, cancelled] = await Promise.all([
    db.order.aggregate({ _sum: { totalPaise: true, discountPaise: true, taxPaise: true }, _count: true, where: { status: { in: [...counted] }, createdAt: range } }),
    db.$queryRaw<{ day: Date; orders: bigint; sales: bigint }[]>`SELECT date_trunc('day', "createdAt") AS day, count(*) AS orders, sum("totalPaise") AS sales FROM "Order" WHERE status IN ('PLACED','PROCESSING','SHIPPED','DELIVERED') AND "createdAt" >= ${range.gte} AND "createdAt" < ${range.lt} GROUP BY 1 ORDER BY 1 DESC`,
    db.$queryRaw<{ name: string; units: bigint; revenue: bigint }[]>`SELECT i.name, sum(i.quantity) AS units, sum(i."lineTotalPaise") AS revenue FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId" WHERE o.status IN ('PLACED','PROCESSING','SHIPPED','DELIVERED') AND o."createdAt" >= ${range.gte} AND o."createdAt" < ${range.lt} GROUP BY i.name ORDER BY revenue DESC LIMIT 10`,
    db.order.groupBy({ by: ["paymentMethod"], _count: true, _sum: { totalPaise: true }, where: { status: { in: [...counted] }, createdAt: range } }),
    db.order.count({ where: { status: "CANCELLED", createdAt: range } }),
  ]);
  const orders = agg._count;
  return (
    <>
      <h1 className="mb-4 font-display text-2xl font-bold">Sales reports</h1>
      <form className="mb-5 flex flex-wrap items-end gap-3"><label className="text-sm">From<input type="date" name="from" defaultValue={from} className="input mt-1" /></label><label className="text-sm">To<input type="date" name="to" defaultValue={to} className="input mt-1" /></label><button className="btn-primary btn-sm">Apply</button></form>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Sales" value={formatINR(agg._sum.totalPaise ?? 0)} sub="Confirmed orders, incl. shipping & taxes" />
        <Stat label="Orders" value={String(orders)} sub={`${cancelled} cancelled in range`} />
        <Stat label="Average order value" value={formatINR(orders ? Math.round((agg._sum.totalPaise ?? 0) / orders) : 0)} />
        <Stat label="Discounts given" value={formatINR(agg._sum.discountPaise ?? 0)} sub={`GST contained: ${formatINR(agg._sum.taxPaise ?? 0)}`} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Sales by day"><Table head={["Date", "Orders", "Sales"]}>{byDay.map((d) => <tr key={d.day.toISOString()}><td className={td}>{d.day.toLocaleDateString("en-IN", { timeZone: "UTC" })}</td><td className={td}>{String(d.orders)}</td><td className={td}>{formatINR(Number(d.sales))}</td></tr>)}</Table>{byDay.length === 0 && <p className="mt-3 text-sm text-ink-500">No confirmed orders in this period.</p>}</Panel>
        <div>
          <Panel title="Top products"><Table head={["Product", "Units", "Revenue"]}>{top.map((t) => <tr key={t.name}><td className={td}>{t.name}</td><td className={td}>{String(t.units)}</td><td className={td}>{formatINR(Number(t.revenue))}</td></tr>)}</Table></Panel>
          <Panel title="By payment method"><Table head={["Method", "Orders", "Sales"]}>{byMethod.map((m) => <tr key={m.paymentMethod}><td className={td}>{m.paymentMethod}</td><td className={td}>{m._count}</td><td className={td}>{formatINR(m._sum.totalPaise ?? 0)}</td></tr>)}</Table></Panel>
        </div>
      </div>
    </>
  );
}
