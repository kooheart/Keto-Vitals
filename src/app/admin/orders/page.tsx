import Link from "next/link";
import type { OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/session";
import { formatINR } from "@/lib/money";
import { STATUS_LABEL } from "@/lib/order-status";
import { Table, td } from "@/components/admin/ui";

const PER = 25;
export default async function Orders({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  await requireAdminPage("orders.manage");
  const sp = await searchParams;
  const status = sp.status && sp.status in STATUS_LABEL ? (sp.status as OrderStatus) : undefined;
  const q = sp.q?.trim();
  const where = { ...(status ? { status } : {}), ...(q ? { OR: [{ number: { contains: q.toUpperCase() } }, { email: { contains: q.toLowerCase() } }, { phone: { contains: q } }] } : {}) };
  const page = Math.max(1, Number(sp.page) || 1);
  const [total, orders] = await Promise.all([db.order.count({ where }), db.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER, take: PER })]);
  const link = (p: number) => `/admin/orders?${new URLSearchParams({ ...(status ? { status } : {}), ...(q ? { q } : {}), page: String(p) })}`;
  return (
    <>
      <h1 className="mb-4 font-display text-2xl font-bold">Orders</h1>
      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Order no., email or phone" className="input max-w-xs" aria-label="Search orders" />
        <select name="status" defaultValue={status ?? ""} className="input max-w-[12rem]" aria-label="Filter by status"><option value="">All statuses</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button className="btn-primary btn-sm">Filter</button>
      </form>
      <Table head={["Order", "Date", "Customer", "Payment", "Status", "Total"]}>
        {orders.map((o) => (
          <tr key={o.id}><td className={td}><Link className="font-medium text-brand-700 underline" href={`/admin/orders/${o.id}`}>{o.number}</Link></td><td className={td}>{o.createdAt.toLocaleDateString("en-IN")}</td><td className={td}>{o.email}</td><td className={td}>{o.paymentMethod} · {o.paymentStatus.toLowerCase()}</td><td className={td}><span className="chip">{STATUS_LABEL[o.status]}</span></td><td className={td}>{formatINR(o.totalPaise)}</td></tr>
        ))}
      </Table>
      {orders.length === 0 && <p className="mt-4 text-sm text-ink-500">No orders match.</p>}
      <p className="mt-3 flex items-center gap-3 text-sm text-ink-600">{total} order(s){page > 1 && <Link href={link(page - 1)} className="underline">← Prev</Link>}{page * PER < total && <Link href={link(page + 1)} className="underline">Next →</Link>}</p>
    </>
  );
}
