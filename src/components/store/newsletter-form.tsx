"use client";
import { useState } from "react";
import { api, FormError, useSubmit } from "@/components/ui/form";

export function NewsletterForm({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState("");
  const s = useSubmit<string>(async (e) => { const r = await api<{ message: string }>("/api/newsletter", "POST", { email: e }); setDone(r.message); setEmail(""); });
  if (done) return <p role="status" className={`text-sm font-medium ${compact ? "text-gold-300" : "text-brand-800"}`}>{done}</p>;
  return (
    <form onSubmit={(e) => { e.preventDefault(); void s.run(email); }} noValidate>
      <div className="flex gap-2">
        <label htmlFor={compact ? "nl-footer" : "nl-main"} className="sr-only">Email address</label>
        <input id={compact ? "nl-footer" : "nl-main"} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" className="input" aria-invalid={!!s.fields.email || undefined} />
        <button className={compact ? "btn-gold" : "btn-primary"} disabled={s.busy}>{s.busy ? "…" : "Subscribe"}</button>
      </div>
      {(s.error || s.fields.email) && <p role="alert" className={`mt-2 text-sm ${compact ? "text-red-300" : "text-red-600"}`}>{s.fields.email ?? s.error}</p>}
    </form>
  );
}
