import { AField } from "./ui";

type P = { name?: string; slug?: string; brand?: string; categoryId?: string; status?: string; form?: string | null; tags?: string[]; gstRate?: number; hsnCode?: string | null; shortDescription?: string | null; description?: string; features?: string[]; specs?: unknown; seoTitle?: string | null; seoDescription?: string | null };

export function ProductFields({ p = {}, cats, withSlug = false }: { p?: P; cats: { id: string; name: string; parentName?: string | null }[]; withSlug?: boolean }) {
  const specs = Object.entries((p.specs ?? {}) as Record<string, string>).map(([k, v]) => `${k}: ${v}`).join("\n");
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <AField label="Name"><input name="name" required defaultValue={p.name} className="input" /></AField>
      {withSlug ? <AField label="URL slug" hint="Changing it changes the product URL"><input name="slug" defaultValue={p.slug} className="input" /></AField> : <AField label="URL slug (optional)" hint="Generated from the name if blank"><input name="slug" className="input" /></AField>}
      <AField label="Brand"><input name="brand" defaultValue={p.brand ?? "Keto Vitals"} className="input" /></AField>
      <AField label="Category"><select name="categoryId" required defaultValue={p.categoryId} className="input"><option value="">Select…</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.parentName ? `${c.parentName} › ` : ""}{c.name}</option>)}</select></AField>
      <AField label="Status" hint="Only ACTIVE products appear in the store"><select name="status" defaultValue={p.status ?? "DRAFT"} className="input"><option>DRAFT</option><option>ACTIVE</option><option>ARCHIVED</option></select></AField>
      <AField label="Type / form" hint="Capsules, Powder, Tea, Gummies…"><input name="form" defaultValue={p.form ?? ""} className="input" /></AField>
      <AField label="GST rate (%)"><input name="gstRate" type="number" min={0} max={40} defaultValue={p.gstRate ?? 18} className="input" /></AField>
      <AField label="HSN code"><input name="hsnCode" defaultValue={p.hsnCode ?? ""} className="input" /></AField>
      <AField label="Tags (comma-separated)" hint="e.g. vegan, sugar-free — used for filters" className="sm:col-span-2"><input name="tags" defaultValue={p.tags?.join(", ")} className="input" /></AField>
      <AField label="Short description" className="sm:col-span-2"><input name="shortDescription" defaultValue={p.shortDescription ?? ""} maxLength={200} className="input" /></AField>
      <AField label="Description" className="sm:col-span-2"><textarea name="description" rows={5} defaultValue={p.description} className="input" /></AField>
      <AField label="Key features (one per line)"><textarea name="features" rows={5} defaultValue={p.features?.join("\n")} className="input" /></AField>
      <AField label="Specifications (Key: Value per line)"><textarea name="specs" rows={5} defaultValue={specs} className="input" /></AField>
      <AField label="SEO title (optional)"><input name="seoTitle" defaultValue={p.seoTitle ?? ""} className="input" /></AField>
      <AField label="SEO description (optional)"><input name="seoDescription" defaultValue={p.seoDescription ?? ""} maxLength={200} className="input" /></AField>
    </div>
  );
}
