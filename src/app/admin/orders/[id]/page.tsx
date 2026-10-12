import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/session";
import { nextStatuses, STATUS_LABEL } from "@/lib/order-status";
import { OrderDetails } from "@/components/store/order-view";
import { ActionForm } from "@/components/admin/action-form";
import { AField, Panel } from "@/components/admin/ui";
import { changeOrderStatus } from "../../actions";

export default async function AdminOrder({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage("orders.manage");
  const o = await db.order.findUnique({ where: { id: (await params).id }, include: { items: true, events: { orderBy: { createdAt: "asc" } }, payments: true } });
  if (!o) notFound();
  const next = nextStatuses(o.status);
  const refundFlag = o.status === "CANCELLED" && o.paymentStatus === "PAID";
  return (
    <>
      <h1 className="mb-1 font-display text-2xl font-bold">Order {o.number}</h1>
      <p className="mb-5 text-sm text-ink-600">{o.email} · {o.phone} · <span className="chip">{STATUS_LABEL[o.status]}</span></p>
      {refundFlag && <p role="alert" className="mb-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">This order is cancelled but a payment was received — issue a refund in the Razorpay dashboard, then mark the order Refunded.</p>}
      {next.length > 0 && (
        <Panel title="Update status">
          <ActionForm action={changeOrderStatus.bind(null, o.id)} submit="Update order" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <AField label="New status"><select name="status" className="input">{next.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></AField>
            <AField label="Carrier" hint="Required details when shipping"><input name="carrier" defaultValue={o.carrier ?? ""} className="input" /></AField>
            <AField label="Tracking number"><input name="trackingNumber" defaultValue={o.trackingNumber ?? ""} className="input" /></AField>
            <AField label="Note (optional)"><input name="note" className="input" /></AField>
          </ActionForm>
        </Panel>
      )}
      <OrderDetails o={o} />
      <Panel title="Payments"><ul className="text-sm">{o.payments.map((p) => <li key={p.id} className="border-b border-ink-100 py-2">{p.provider} · {p.status} · {p.providerOrderId ?? "—"} / {p.providerPaymentId ?? "—"}{p.failureReason ? ` · ${p.failureReason}` : ""}</li>)}</ul></Panel>
    </>
  );
}
