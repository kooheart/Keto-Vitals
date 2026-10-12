import type { Coupon } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/session";
import { ActionForm } from "@/components/admin/action-form";
import { AField, Panel } from "@/components/admin/ui";
import { deleteCoupon, saveCoupon } from "../actions";

const dt = (d: Date | null) => (d ? d.toISOString().slice(0, 16) : "");

function Fields({ c }: { c?: Coupon }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <AField label="Code"><input name="code" required defaultValue={c?.code} className="input uppercase" /></AField>
      <AField label="Type"><select name="type" defaultValue={c?.type ?? "PERCENT"} className="input"><option value="PERCENT">Percent off</option><option value="FIXED">Fixed ₹ off</option><option value="FREE_SHIPPING">Free shipping</option></select></AField>
      <AField label="Value" hint="% for percent, ₹ for fixed"><input name="value" type="number" step="0.01" min="0" defaultValue={c ? (c.type === "FIXED" ? c.value / 100 : c.value) : ""} className="input" /></AField>
      <AField label="Min. subtotal (₹)"><input name="minSubtotal" type="number" step="0.01" min="0" defaultValue={c ? c.minSubtotalPaise / 100 : 0} className="input" /></AField>
      <AField label="Max discount (₹)" hint="Optional cap for percent"><input name="maxDiscount" type="number" step="0.01" min="0" defaultValue={c?.maxDiscountPaise ? c.maxDiscountPaise / 100 : ""} className="input" /></AField>
      <AField label="Total uses limit"><input name="usageLimit" type="number" min="1" defaultValue={c?.usageLimit ?? ""} className="input" /></AField>
      <AField label="Uses per customer"><input name="perUserLimit" type="number" min="1" defaultValue={c?.perUserLimit ?? ""} className="input" /></AField>
      <AField label="Description"><input name="description" defaultValue={c?.description ?? ""} className="input" /></AField>
      <AField label="Starts (UTC)"><input name="startsAt" type="datetime-local" defaultValue={dt(c?.startsAt ?? null)} className="input" /></AField>
      <AField label="Ends (UTC)"><input name="endsAt" type="datetime-local" defaultValue={dt(c?.endsAt ?? null)} className="input" /></AField>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={c?.isActive ?? true} className="h-4 w-4 accent-brand-700" /> Active</label>
    </div>
  );
}

export default async function Coupons() {
  await requireAdminPage("coupons.write");
  const coupons = await db.coupon.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <>
      <h1 className="mb-4 font-display text-2xl font-bold">Coupons & discount codes</h1>
      <Panel title="New coupon"><ActionForm action={saveCoupon.bind(null, null)} submit="Create coupon"><Fields /></ActionForm></Panel>
      {coupons.map((c) => (
        <Panel key={c.id} title={`${c.code} · used ${c.usedCount}${c.usageLimit ? ` / ${c.usageLimit}` : ""}`}>
          <ActionForm action={saveCoupon.bind(null, c.id)} submit="Save"><Fields c={c} /></ActionForm>
          <ActionForm action={deleteCoupon.bind(null, c.id)} submit="Delete" danger confirm={`Delete ${c.code}?`} className="mt-2" />
        </Panel>
      ))}
    </>
  );
}
