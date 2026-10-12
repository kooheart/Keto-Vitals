import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/session";
import { ActionForm } from "@/components/admin/action-form";
import { Table, td } from "@/components/admin/ui";
import { setStock } from "../actions";

export default async function Inventory({ searchParams }: { searchParams: Promise<{ q?: string; low?: string }> }) {
  await requireAdminPage("inventory.write");
  const { q, low } = await searchParams;
  const variants = await db.productVariant.findMany({
    where: q ? { OR: [{ sku: { contains: q, mode: "insensitive" } }, { product: { name: { contains: q, mode: "insensitive" } } }] } : {},
    include: { product: { select: { name: true, status: true } }, inventory: true }, orderBy: [{ inventory: { quantity: "asc" } }], take: 200,
  });
  const rows = low ? variants.filter((v) => (v.inventory?.quantity ?? 0) <= (v.inventory?.lowStockThreshold ?? 10)) : variants;
  return (
    <>
      <h1 className="mb-4 font-display text-2xl font-bold">Inventory</h1>
      <form className="mb-4 flex flex-wrap items-center gap-2" role="search"><input name="q" defaultValue={q} placeholder="Product or SKU" className="input max-w-xs" aria-label="Search" /><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="low" value="1" defaultChecked={!!low} className="h-4 w-4" /> Low stock only</label><button className="btn-primary btn-sm">Filter</button></form>
      <Table head={["Product", "SKU", "On hand", "Low-stock alert at", ""]}>
        {rows.map((v) => (
          <tr key={v.id}>
            <td className={td}>{v.product.name} <span className="text-ink-500">· {v.name}</span>{v.product.status !== "ACTIVE" && <span className="chip ml-2">{v.product.status}</span>}</td><td className={td}>{v.sku}</td>
            <td colSpan={3} className={td}><ActionForm action={setStock.bind(null, v.id)} submit="Update" className="flex flex-wrap items-center gap-2"><input name="quantity" type="number" min={0} defaultValue={v.inventory?.quantity ?? 0} className="input w-24" aria-label={`Quantity for ${v.sku}`} /><input name="threshold" type="number" min={0} defaultValue={v.inventory?.lowStockThreshold ?? 10} className="input w-24" aria-label={`Low-stock threshold for ${v.sku}`} /></ActionForm></td>
          </tr>
        ))}
      </Table>
    </>
  );
}
