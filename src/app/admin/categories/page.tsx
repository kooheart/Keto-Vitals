import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/session";
import { ActionForm } from "@/components/admin/action-form";
import { AField, Panel } from "@/components/admin/ui";
import { deleteCategory, saveCategory } from "../actions";

export default async function Categories() {
  await requireAdminPage("categories.write");
  const cats = await db.category.findMany({ include: { _count: { select: { products: true } }, parent: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const roots = cats.filter((c) => !c.parentId);
  const fields = (c?: (typeof cats)[number]) => (
    <div className="grid gap-3 sm:grid-cols-3">
      <AField label="Name"><input name="name" required defaultValue={c?.name} className="input" /></AField>
      <AField label="Slug"><input name="slug" defaultValue={c?.slug} className="input" /></AField>
      <AField label="Parent"><select name="parentId" defaultValue={c?.parentId ?? ""} className="input"><option value="">— top level —</option>{roots.filter((r) => r.id !== c?.id).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></AField>
      <AField label="Description" className="sm:col-span-2"><input name="description" defaultValue={c?.description ?? ""} className="input" /></AField>
      <AField label="Sort order"><input name="sortOrder" type="number" defaultValue={c?.sortOrder ?? 0} className="input" /></AField>
      <AField label="Image (optional)"><input type="file" name="image" accept="image/jpeg,image/png,image/webp" className="input pt-2" /></AField>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={c?.isActive ?? true} className="h-4 w-4 accent-brand-700" /> Visible in store</label>
    </div>
  );
  return (
    <>
      <h1 className="mb-4 font-display text-2xl font-bold">Categories</h1>
      <Panel title="Add category"><ActionForm action={saveCategory.bind(null, null)} submit="Add category">{fields()}</ActionForm></Panel>
      {cats.map((c) => (
        <Panel key={c.id} title={`${c.parent ? c.parent.name + " › " : ""}${c.name} (${c._count.products} products)`}>
          <ActionForm action={saveCategory.bind(null, c.id)} submit="Save">{fields(c)}</ActionForm>
          <ActionForm action={deleteCategory.bind(null, c.id)} submit="Delete" danger confirm={`Delete ${c.name}?`} className="mt-2" />
        </Panel>
      ))}
    </>
  );
}
