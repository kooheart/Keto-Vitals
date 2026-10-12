"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, FormError, api, useSubmit } from "@/components/ui/form";

export function TrackForm() {
  const [num, setNum] = useState("");
  const [email, setEmail] = useState("");
  const router = useRouter();
  const s = useSubmit<void>(async () => {
    const r = await api<{ url: string }>("/api/track", "POST", { number: num, email });
    router.push(r.url);
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); void s.run(); }} className="mt-6 space-y-4" noValidate>
      <FormError message={s.error} />
      <Field label="Order number" error={s.fields.number} hint="e.g. KV-261012-AB12CD">{(p) => <input {...p} className="input uppercase" value={num} onChange={(e) => setNum(e.target.value)} />}</Field>
      <Field label="Email used for the order" error={s.fields.email}>{(p) => <input {...p} type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
      <button className="btn-primary" disabled={s.busy}>{s.busy ? "Looking up…" : "Track order"}</button>
    </form>
  );
}
