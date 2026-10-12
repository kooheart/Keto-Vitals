import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/session";
import { formatINR } from "@/lib/money";
import { Table, td } from "@/components/admin/ui";

export default async function Products({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  await requireAdminPage("products.write");
  const { q, status } = await searchParams;
  const products = await db.product.findMany({
    where: { ...(status === "DRAFT" || status === "ACTIVE" || status === "ARCHIVED" ? { status } : {}), ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q.toLowerCase() } }, { variants: { some: { sku: { contains: q, mode: "insensitive" } } } }] } : {}) },
    include: { category: { select: { name: true } }, images: { take: 1, orderBy: { sortOrder: "asc" } }, variants: { include: { inventory: true } } }, orderBy: { updatedAt: "desc" }, take: 100,
  });
  return (
    <>
      <div className="mb-4 flex items-center justify-between"><h1 className="font-display text-2xl font-bold">Products</h1><Link href="/admin/products/new" className="btn-primary btn-sm">New product</Link></div>
      <form className="mb-4 flex flex-wrap gap-2" role="search"><input name="q" defaultValue={q} placeholder="Name, slug or SKU" className="input max-w-xs" aria-label="Search products" /><select name="status" defaultValue={status ?? ""} className="input max-w-[10rem]" aria-label="Status"><option value="">Any status</option><option>ACTIVE</option><option>DRAFT</option><option>ARCHIVED</option></select><button className="btn-primary btn-sm">Filter</button></form>
      <Table head={["Product", "Category", "Status", "Price", "Stock"]}>
        {products.map((p) => (
          <tr key={p.id}>
            <td className={td}><Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 font-medium text-brand-700 underline">{/* eslint-disable-next-line @next/next/no-img-element */}{p.images[0] && <img src={p.images[0].url} alt="" className="h-10 w-10 rounded object-cover" />}{p.name}</Link></td>
            <td className={td}>{p.category.name}</td><td className={td}><span className="chip">{p.status}</span></td><td className={td}>{formatINR(p.minPricePaise)}</td>
            <td className={td}>{p.variants.reduce((a, v) => a + (v.inventory?.quantity ?? 0), 0)}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
