import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/session";
import { formatINR } from "@/lib/money";
import { ActionForm } from "@/components/admin/action-form";
import { Table, td } from "@/components/admin/ui";
import { hasPermission } from "@/lib/auth/permissions";
import { toggleCustomer } from "../actions";

export default async function Customers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const me = await requireAdminPage("customers.view");
  const { q } = await searchParams;
  const users = await db.user.findMany({
    where: { role: { name: "customer" }, ...(q ? { OR: [{ email: { contains: q.toLowerCase() } }, { name: { contains: q, mode: "insensitive" } }] } : {}) },
    orderBy: { createdAt: "desc" }, take: 100, include: { orders: { where: { status: { in: ["PLACED", "PROCESSING", "SHIPPED", "DELIVERED"] } }, select: { totalPaise: true } } },
  });
  const canDisable = hasPermission(me.permissions, "settings.write");
  return (
    <>
      <h1 className="mb-4 font-display text-2xl font-bold">Customers</h1>
      <form className="mb-4 flex gap-2" role="search"><input name="q" defaultValue={q} placeholder="Name or email" className="input max-w-xs" aria-label="Search customers" /><button className="btn-primary btn-sm">Search</button></form>
      <Table head={["Customer", "Joined", "Orders", "Spend", "Status"]}>
        {users.map((u) => (
          <tr key={u.id}><td className={td}><strong>{u.name}</strong><br /><span className="text-ink-500">{u.email}</span></td><td className={td}>{u.createdAt.toLocaleDateString("en-IN")}</td><td className={td}>{u.orders.length}</td><td className={td}>{formatINR(u.orders.reduce((a, o) => a + o.totalPaise, 0))}</td>
            <td className={td}>{u.disabledAt ? <span className="chip bg-red-50 text-red-700">Disabled</span> : <span className="chip">Active</span>}{canDisable && <ActionForm action={toggleCustomer.bind(null, u.id)} submit={u.disabledAt ? "Enable" : "Disable"} danger={!u.disabledAt} confirm={u.disabledAt ? undefined : `Disable ${u.email}?`} className="mt-2" />}</td></tr>
        ))}
      </Table>
    </>
  );
}
