import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/session";
import { ActionForm } from "@/components/admin/action-form";
import { ProductFields } from "@/components/admin/product-fields";
import { AField, Panel } from "@/components/admin/ui";
import { addVariant, deleteProduct, deleteProductImage, updateProduct, updateVariant, uploadProductImage } from "../../actions";

function VariantFields({ v }: { v?: { sku: string; name: string; attributes: unknown; mrpPaise: number; pricePaise: number; weightGrams: number; isActive: boolean; inventory: { quantity: number } | null } }) {
  const attrs = Object.entries((v?.attributes ?? {}) as Record<string, string>).map(([k, x]) => `${k}: ${x}`).join("\n");
  return (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <AField label="SKU"><input name="sku" required defaultValue={v?.sku} className="input" /></AField>
      <AField label="Label"><input name="name" required defaultValue={v?.name} className="input" placeholder="60 capsules" /></AField>
      <AField label="MRP (₹)"><input name="mrp" type="number" step="0.01" min="0" required defaultValue={v ? v.mrpPaise / 100 : ""} className="input" /></AField>
      <AField label="Price (₹)"><input name="price" type="number" step="0.01" min="0" required defaultValue={v ? v.pricePaise / 100 : ""} className="input" /></AField>
      <AField label="Weight (g)"><input name="weightGrams" type="number" min="0" defaultValue={v?.weightGrams ?? 250} className="input" /></AField>
      {v ? <AField label="Stock"><input disabled value={v.inventory?.quantity ?? 0} className="input" aria-describedby="stk" /><span id="stk" className="text-xs text-ink-500">Edit under Inventory</span></AField> : <AField label="Opening stock"><input name="stock" type="number" min="0" defaultValue={0} className="input" /></AField>}
      <AField label="Selector attributes (Key: Value)" className="sm:col-span-2 lg:col-span-3" hint="e.g. Size: 60 capsules"><textarea name="attributes" rows={2} defaultValue={attrs} className="input" /></AField>
      {v && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={v.isActive} className="h-4 w-4 accent-brand-700" /> Active</label>}
    </div>
  );
}

export default async function EditProduct({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  await requireAdminPage("products.write");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [p, cats] = await Promise.all([
    db.product.findUnique({ where: { id }, include: { images: { orderBy: { sortOrder: "asc" } }, variants: { orderBy: { sortOrder: "asc" }, include: { inventory: true } } } }),
    db.category.findMany({ include: { parent: true }, orderBy: { name: "asc" } }),
  ]);
  if (!p) notFound();
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h1 className="font-display text-2xl font-bold">{p.name}</h1>{p.status === "ACTIVE" && <Link href={`/product/${p.slug}`} className="text-sm text-brand-700 underline" target="_blank">View in store ↗</Link>}</div>
      {sp.created && <p role="status" className="mb-4 rounded bg-brand-50 p-3 text-sm text-brand-800">Product created. Add at least one variant (price & stock) and an image, then set status to ACTIVE.</p>}
      <Panel title="Details"><ActionForm action={updateProduct.bind(null, p.id)} submit="Save product"><ProductFields p={p} withSlug cats={cats.map((c) => ({ id: c.id, name: c.name, parentName: c.parent?.name }))} /></ActionForm></Panel>
      <Panel title="Variants, pricing & stock">
        <div className="space-y-5">{p.variants.map((v) => <ActionForm key={v.id} action={updateVariant.bind(null, v.id)} submit="Save variant" className="rounded-lg border border-ink-100 p-3"><VariantFields v={v} /></ActionForm>)}</div>
        <h3 className="mb-2 mt-6 text-sm font-semibold">Add a variant</h3>
        <ActionForm action={addVariant.bind(null, p.id)} submit="Add variant"><VariantFields /></ActionForm>
      </Panel>
      <Panel title="Images">
        <ul className="mb-4 flex flex-wrap gap-4">{p.images.map((im) => <li key={im.id} className="w-32 text-xs">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={im.url} alt={im.alt} className="h-32 w-32 rounded border border-ink-100 object-cover" /><p className="mt-1 truncate">{im.alt}</p><ActionForm action={deleteProductImage.bind(null, im.id)} submit="Remove" danger confirm="Remove this image?" /></li>)}</ul>
        <ActionForm action={uploadProductImage.bind(null, p.id)} submit="Upload image" className="grid max-w-xl gap-3"><AField label="Image file (JPEG, PNG or WebP, up to 5 MB)"><input type="file" name="file" accept="image/jpeg,image/png,image/webp" required className="input pt-2" /></AField><AField label="Alt text (describe the image)"><input name="alt" className="input" /></AField></ActionForm>
      </Panel>
      <Panel title="Danger zone"><ActionForm action={deleteProduct.bind(null, p.id)} submit="Delete product" danger confirm="Delete this product? Products with order history are archived instead." /></Panel>
    </>
  );
}
