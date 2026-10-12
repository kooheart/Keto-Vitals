"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, FormError, api, useSubmit } from "@/components/ui/form";
import { INDIAN_STATES } from "@/lib/shipping";
import { useToast } from "@/components/ui/toast";

export function ProfileForm({ name, phone }: { name: string; phone: string }) {
  const [v, setV] = useState({ name, phone });
  const { toast } = useToast();
  const router = useRouter();
  const s = useSubmit<void>(async () => { await api("/api/account/profile", "PATCH", v); toast({ kind: "success", message: "Profile saved" }); router.refresh(); });
  return (
    <form onSubmit={(e) => { e.preventDefault(); void s.run(); }} className="space-y-4" noValidate>
      <FormError message={s.error} />
      <Field label="Full name" error={s.fields.name}>{(p) => <input {...p} className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />}</Field>
      <Field label="Mobile" error={s.fields.phone}>{(p) => <input {...p} type="tel" className="input" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />}</Field>
      <button className="btn-primary" disabled={s.busy}>Save changes</button>
    </form>
  );
}

export function PasswordForm() {
  const [v, setV] = useState({ current: "", next: "" });
  const { toast } = useToast();
  const s = useSubmit<void>(async () => { await api("/api/auth/password", "POST", v); toast({ kind: "success", message: "Password changed. Other devices were signed out." }); setV({ current: "", next: "" }); });
  return (
    <form onSubmit={(e) => { e.preventDefault(); void s.run(); }} className="space-y-4" noValidate>
      <FormError message={s.error} />
      <Field label="Current password" error={s.fields.current}>{(p) => <input {...p} type="password" autoComplete="current-password" className="input" value={v.current} onChange={(e) => setV({ ...v, current: e.target.value })} />}</Field>
      <Field label="New password" error={s.fields.next} hint="At least 10 characters, with a letter and a number">{(p) => <input {...p} type="password" autoComplete="new-password" className="input" value={v.next} onChange={(e) => setV({ ...v, next: e.target.value })} />}</Field>
      <button className="btn-primary" disabled={s.busy}>Change password</button>
    </form>
  );
}

export function ResendVerify() {
  const { toast } = useToast();
  return <button className="btn-outline btn-sm" onClick={async () => { try { const r = await api<{ message: string }>("/api/auth/verify", "POST", {}); toast({ kind: "success", message: r.message }); } catch { toast({ kind: "error", message: "Could not send the email." }); } }}>Resend verification email</button>;
}

type Addr = { id: string; fullName: string; phone: string; line1: string; line2: string | null; landmark: string | null; city: string; state: string; pincode: string; isDefault: boolean };

export function AddressManager({ addresses }: { addresses: Addr[] }) {
  const router = useRouter();
  const empty = { fullName: "", phone: "", line1: "", line2: "", landmark: "", city: "", state: "", pincode: "", isDefault: false };
  const [v, setV] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const s = useSubmit<void>(async () => {
    await api("/api/account/addresses", editing ? "PUT" : "POST", editing ? { id: editing, ...v } : v);
    setOpen(false); setEditing(null); setV(empty); router.refresh();
  });
  const f = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });
  return (
    <div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {addresses.map((a) => (
          <li key={a.id} className="card p-4 text-sm">
            {a.isDefault && <span className="chip mb-2">Default</span>}
            <address className="not-italic"><strong>{a.fullName}</strong><br />{a.line1}{a.line2 ? `, ${a.line2}` : ""}<br />{a.city}, {a.state} {a.pincode}<br />{a.phone}</address>
            <div className="mt-3 flex gap-3">
              <button className="font-semibold text-brand-700 underline" onClick={() => { setEditing(a.id); setV({ ...a, line2: a.line2 ?? "", landmark: a.landmark ?? "" }); setOpen(true); }}>Edit</button>
              <button className="text-red-600 underline" onClick={async () => { await api("/api/account/addresses", "DELETE", { id: a.id }); router.refresh(); }}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
      {addresses.length === 0 && !open && <p className="text-ink-600">You haven’t saved any addresses yet.</p>}
      {!open ? <button className="btn-primary mt-5" onClick={() => { setEditing(null); setV(empty); setOpen(true); }}>Add new address</button> : (
        <form onSubmit={(e) => { e.preventDefault(); void s.run(); }} className="card mt-5 space-y-4 p-5" noValidate>
          <h3 className="font-semibold">{editing ? "Edit address" : "New address"}</h3>
          <FormError message={s.error} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" error={s.fields.fullName}>{(p) => <input {...p} className="input" value={v.fullName} onChange={f("fullName")} />}</Field>
            <Field label="Mobile" error={s.fields.phone}>{(p) => <input {...p} className="input" value={v.phone} onChange={f("phone")} />}</Field>
          </div>
          <Field label="Address" error={s.fields.line1}>{(p) => <input {...p} className="input" value={v.line1} onChange={f("line1")} />}</Field>
          <Field label="Apartment, area (optional)" error={s.fields.line2}>{(p) => <input {...p} className="input" value={v.line2} onChange={f("line2")} />}</Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="PIN code" error={s.fields.pincode}>{(p) => <input {...p} inputMode="numeric" maxLength={6} className="input" value={v.pincode} onChange={f("pincode")} />}</Field>
            <Field label="City" error={s.fields.city}>{(p) => <input {...p} className="input" value={v.city} onChange={f("city")} />}</Field>
            <Field label="State" error={s.fields.state}>{(p) => <select {...p} className="input" value={v.state} onChange={f("state")}><option value="">Select</option>{INDIAN_STATES.map((x) => <option key={x}>{x}</option>)}</select>}</Field>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.isDefault} onChange={(e) => setV({ ...v, isDefault: e.target.checked })} className="h-4 w-4 accent-brand-700" /> Make default</label>
          <div className="flex gap-3"><button className="btn-primary" disabled={s.busy}>Save address</button><button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button></div>
        </form>
      )}
    </div>
  );
}
