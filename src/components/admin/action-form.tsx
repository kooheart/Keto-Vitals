"use client";
import { useActionState } from "react";
import type { ActionState } from "@/lib/admin/run";

type Action = (state: ActionState, fd: FormData) => Promise<ActionState>;

export function ActionForm({ action, children, submit = "Save", className = "", danger = false, confirm, hideSubmit = false }: { action: Action; children?: React.ReactNode; submit?: string; className?: string; danger?: boolean; confirm?: string; hideSubmit?: boolean }) {
  const [state, run, pending] = useActionState(action, null);
  return (
    <form action={run} className={className} onSubmit={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}>
      {children}
      {!hideSubmit && <button className={`${danger ? "btn-danger" : "btn-primary"} btn-sm mt-1`} disabled={pending}>{pending ? "Working…" : submit}</button>}
      {state?.error && <p role="alert" className="mt-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p role="status" className="mt-2 rounded bg-brand-50 px-3 py-2 text-sm text-brand-800">{state.ok}</p>}
    </form>
  );
}
