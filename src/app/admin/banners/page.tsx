import type { Banner } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/session";
import { ActionForm } from "@/components/admin/action-form";
import { AField, Panel } from "@/components/admin/ui";
import { deleteBanner, saveBanner } from "../actions";

function Fields({ b }: { b?: Banner }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <AField label="Placement"><select name="placement" defaultValue={b?.placement ?? "HERO"} className="input"><option value="HERO">Hero slider</option><option value="MID">Mid-page banner</option></select></AField>
      <AField label="Eyebrow"><input name="eyebrow" defaultValue={b?.eyebrow ?? ""} className="input" /></AField>
      <AField label="Title"><input name="title" required defaultValue={b?.title} className="input" /></AField>
      <AField label="Subtitle" className="sm:col-span-3"><input name="subtitle" defaultValue={b?.subtitle ?? ""} className="input" /></AField>
      <AField label="Button label"><input name="ctaLabel" defaultValue={b?.ctaLabel ?? ""} className="input" /></AField>
      <AField label="Link" hint="/path or https://…"><input name="linkUrl" defaultValue={b?.linkUrl ?? ""} className="input" /></AField>
      <AField label="Theme (mid banners)"><select name="theme" defaultValue={b?.theme ?? "dark"} className="input"><option>dark</option><option>light</option><option>gold</option></select></AField>
      <AField label="Sort order"><input name="sortOrder" type="number" defaultValue={b?.sortOrder ?? 0} className="input" /></AField>
      <AField label="Image (optional)"><input type="file" name="image" accept="image/jpeg,image/png,image/webp" className="input pt-2" /></AField>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={b?.isActive ?? true} className="h-4 w-4 accent-brand-700" /> Active</label>
    </div>
  );
}

export default async function Banners() {
  await requireAdminPage("marketing.write");
  const banners = await db.banner.findMany({ orderBy: [{ placement: "asc" }, { sortOrder: "asc" }] });
  return (
    <>
      <h1 className="mb-4 font-display text-2xl font-bold">Homepage banners</h1>
      <Panel title="Add banner"><ActionForm action={saveBanner.bind(null, null)} submit="Add banner"><Fields /></ActionForm></Panel>
      {banners.map((b) => <Panel key={b.id} title={`${b.placement} · ${b.title}`}><ActionForm action={saveBanner.bind(null, b.id)} submit="Save"><Fields b={b} /></ActionForm><ActionForm action={deleteBanner.bind(null, b.id)} submit="Delete" danger confirm="Delete this banner?" className="mt-2" /></Panel>)}
    </>
  );
}
