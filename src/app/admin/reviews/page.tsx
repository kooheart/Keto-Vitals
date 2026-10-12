import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/session";
import { ActionForm } from "@/components/admin/action-form";
import { Stars } from "@/components/ui/stars";
import { Panel } from "@/components/admin/ui";
import { moderateReview } from "../actions";

export default async function Reviews({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdminPage("reviews.moderate");
  const status = (await searchParams).status === "APPROVED" ? "APPROVED" : (await searchParams).status === "REJECTED" ? "REJECTED" : "PENDING";
  const reviews = await db.review.findMany({ where: { status }, orderBy: { createdAt: "desc" }, take: 50, include: { user: { select: { name: true, email: true } }, product: { select: { name: true } } } });
  return (
    <>
      <h1 className="mb-4 font-display text-2xl font-bold">Review moderation</h1>
      <nav className="mb-4 flex gap-3 text-sm" aria-label="Status">{["PENDING", "APPROVED", "REJECTED"].map((s) => <a key={s} href={`?status=${s}`} className={`rounded-full px-3 py-1 ${s === status ? "bg-brand-700 text-white" : "bg-white border border-ink-200"}`}>{s.toLowerCase()}</a>)}</nav>
      {reviews.length === 0 && <p className="text-ink-500">No {status.toLowerCase()} reviews.</p>}
      {reviews.map((r) => (
        <Panel key={r.id}>
          <div className="flex flex-wrap items-center gap-2"><Stars value={r.rating} count={1} /><strong>{r.title}</strong>{r.verifiedPurchase && <span className="chip">Verified purchase</span>}</div>
          <p className="mt-1 text-sm">{r.body}</p>
          <p className="mt-1 text-xs text-ink-500">{r.user.name} ({r.user.email}) on {r.product.name} · {r.createdAt.toLocaleDateString("en-IN")}</p>
          <div className="mt-3 flex gap-2">
            {status !== "APPROVED" && <ActionForm action={moderateReview.bind(null, r.id, "APPROVED")} submit="Approve" />}
            {status !== "REJECTED" && <ActionForm action={moderateReview.bind(null, r.id, "REJECTED")} submit="Reject" danger />}
          </div>
        </Panel>
      ))}
    </>
  );
}
