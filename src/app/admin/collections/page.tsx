import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/session";
import { ActionForm } from "@/components/admin/action-form";
import { AField, Panel } from "@/components/admin/ui";
import { deleteCollection, saveCollection } from "../actions";

export default async function Collections() {
  await requireAdminPage("categories.write");
  const cols = await db.collection.findMany({ orderBy: { sortOrder: "asc" }, include: { products: { orderBy: { position: "asc" }, include: { product: { select: { slug: true } } } } } });
  const fields = (c?: (typeof cols)[number]) => (
    <div className="grid gap-3 sm:grid-cols-3">
      <AField label="Name"><input name="name" required defaultValue={c?.name} className="input" /></AField>
      <AField label="Slug"><input name="slug" defaultValue={c?.slug} className="input" /></AField>
      <AField label="Sort order"><input name="sortOrder" type="number" defaultValue={c?.sortOrder ?? 0} className="input" /></AField>
      <AField label="Description" className="sm:col-span-3"><input name="description" defaultValue={c?.description ?? ""} className="input" /></AField>
      <AField label="Product slugs (comma or newline separated)" className="sm:col-span-3"><textarea name="products" rows={2} defaultValue={c?.products.map((p) => p.product.slug).join(", ")} className="input" /></AField>
      <AField label="Image (optional)"><input type="file" name="image" accept="image/jpeg,image/png,image/webp" className="input pt-2" /></AField>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isFeatured" defaultChecked={c?.isFeatured ?? true} className="h-4 w-4 accent-brand-700" /> Featured on homepage</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={c?.isActive ?? true} className="h-4 w-4 accent-brand-700" /> Active</label>
    </div>
  );
  return (
    <>
      <h1 className="mb-4 font-display text-2xl font-bold">Collections</h1>
      <Panel title="Add collection"><ActionForm action={saveCollection.bind(null, null)} submit="Add collection">{fields()}</ActionForm></Panel>
      {cols.map((c) => <Panel key={c.id} title={c.name}><ActionForm action={saveCollection.bind(null, c.id)} submit="Save">{fields(c)}</ActionForm><ActionForm action={deleteCollection.bind(null, c.id)} submit="Delete" danger confirm={`Delete ${c.name}?`} className="mt-2" /></Panel>)}
    </>
  );
}
