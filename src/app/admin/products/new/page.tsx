import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/session";
import { ActionForm } from "@/components/admin/action-form";
import { ProductFields } from "@/components/admin/product-fields";
import { Panel } from "@/components/admin/ui";
import { createProduct } from "../../actions";

export default async function NewProduct() {
  await requireAdminPage("products.write");
  const cats = await db.category.findMany({ include: { parent: true }, orderBy: { name: "asc" } });
  return (
    <>
      <h1 className="mb-4 font-display text-2xl font-bold">New product</h1>
      <Panel><ActionForm action={createProduct} submit="Create product"><ProductFields cats={cats.map((c) => ({ id: c.id, name: c.name, parentName: c.parent?.name }))} /></ActionForm><p className="mt-3 text-xs text-ink-500">After creating the product you can add variants (price & stock) and images.</p></Panel>
    </>
  );
}
