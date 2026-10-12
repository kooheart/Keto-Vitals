"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { api, FormError, useSubmit } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

export function ReviewForm({ productId, signedIn }: { productId: string; signedIn: boolean }) {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const router = useRouter();
  const { toast } = useToast();
  const s = useSubmit<void>(async () => {
    const r = await api<{ message: string }>("/api/reviews", "POST", { productId, rating, title: title || undefined, body });
    toast({ kind: "success", message: r.message });
    setBody(""); setTitle(""); setRating(0);
  });
  if (!signedIn) return <p className="text-sm text-ink-600"><a href={`/login?next=${encodeURIComponent(typeof window === "undefined" ? "" : location.pathname)}`} className="font-semibold text-brand-700 underline">Sign in</a> to write a review.</p>;
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!rating) return; void s.run(); router.refresh(); }} className="space-y-3" noValidate>
      <FormError message={s.error} />
      <fieldset><legend className="label">Your rating</legend>
        <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" aria-label={`${n} star${n > 1 ? "s" : ""}`} aria-pressed={rating === n} onClick={() => setRating(n)} className="p-1"><Star className={`h-7 w-7 ${n <= rating ? "fill-gold-400 text-gold-400" : "text-ink-300"}`} /></button>)}</div>
        {!rating && <p className="text-xs text-ink-500">Select a rating to submit.</p>}
      </fieldset>
      <div><label htmlFor="rt" className="label">Title (optional)</label><input id="rt" className="input" maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div><label htmlFor="rb" className="label">Review</label><textarea id="rb" rows={4} className="input" value={body} onChange={(e) => setBody(e.target.value)} aria-invalid={!!s.fields.body || undefined} />{s.fields.body && <p className="field-error">{s.fields.body}</p>}</div>
      <button className="btn-primary" disabled={s.busy || !rating}>{s.busy ? "Submitting…" : "Submit review"}</button>
    </form>
  );
}
