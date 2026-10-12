"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Field, FormError, api, useSubmit } from "@/components/ui/form";

const safeNext = (n?: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/");

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [v, setV] = useState({ email: "", password: "" });
  const s = useSubmit<void>(async () => { await api("/api/auth/login", "POST", v); router.push(safeNext(next)); router.refresh(); });
  return (
    <form onSubmit={(e) => { e.preventDefault(); void s.run(); }} className="space-y-4" noValidate>
      <FormError message={s.error} />
      <Field label="Email" error={s.fields.email}>{(p) => <input {...p} type="email" autoComplete="email" className="input" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />}</Field>
      <Field label="Password" error={s.fields.password}>{(p) => <input {...p} type="password" autoComplete="current-password" className="input" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} />}</Field>
      <button className="btn-primary w-full" disabled={s.busy}>{s.busy ? "Signing in…" : "Sign in"}</button>
      <p className="flex justify-between text-sm"><Link href="/forgot-password" className="text-brand-700 underline">Forgot password?</Link><Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-brand-700 underline">Create an account</Link></p>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const router = useRouter();
  const [v, setV] = useState({ name: "", email: "", phone: "", password: "" });
  const s = useSubmit<void>(async () => { await api("/api/auth/register", "POST", v); router.push(safeNext(next)); router.refresh(); });
  return (
    <form onSubmit={(e) => { e.preventDefault(); void s.run(); }} className="space-y-4" noValidate>
      <FormError message={s.error} />
      <Field label="Full name" error={s.fields.name}>{(p) => <input {...p} autoComplete="name" className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />}</Field>
      <Field label="Email" error={s.fields.email}>{(p) => <input {...p} type="email" autoComplete="email" className="input" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />}</Field>
      <Field label="Mobile (optional)" error={s.fields.phone}>{(p) => <input {...p} type="tel" autoComplete="tel-national" className="input" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />}</Field>
      <Field label="Password" error={s.fields.password} hint="At least 10 characters, with a letter and a number">{(p) => <input {...p} type="password" autoComplete="new-password" className="input" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} />}</Field>
      <button className="btn-primary w-full" disabled={s.busy}>{s.busy ? "Creating account…" : "Create account"}</button>
      <p className="text-sm">Already registered? <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-brand-700 underline">Sign in</Link></p>
    </form>
  );
}

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const s = useSubmit<void>(async () => { const r = await api<{ message: string }>("/api/auth/forgot", "POST", { email }); setMsg(r.message); });
  if (msg) return <p role="status" className="rounded-lg bg-brand-50 p-4 text-sm text-brand-900">{msg}</p>;
  return (
    <form onSubmit={(e) => { e.preventDefault(); void s.run(); }} className="space-y-4" noValidate>
      <FormError message={s.error} />
      <Field label="Email" error={s.fields.email}>{(p) => <input {...p} type="email" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
      <button className="btn-primary w-full" disabled={s.busy}>Send reset link</button>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const s = useSubmit<void>(async () => { await api("/api/auth/reset", "POST", { token, password }); router.push("/login?reset=1"); });
  return (
    <form onSubmit={(e) => { e.preventDefault(); void s.run(); }} className="space-y-4" noValidate>
      <FormError message={s.error} />
      <Field label="New password" error={s.fields.password} hint="At least 10 characters, with a letter and a number">{(p) => <input {...p} type="password" autoComplete="new-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
      <button className="btn-primary w-full" disabled={s.busy}>Set new password</button>
    </form>
  );
}

export function VerifyEmail({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");
  const s = useSubmit<void>(async () => { try { await api("/api/auth/verify", "POST", { token }); setState("ok"); } catch (e) { setState("err"); throw e; } });
  if (state === "ok") return <p role="status" className="rounded-lg bg-brand-50 p-4 text-brand-900">Your email is verified. Thank you!</p>;
  return <div className="space-y-4"><FormError message={s.error || msg} /><button className="btn-primary" onClick={() => void s.run()} disabled={s.busy}>Confirm my email address</button></div>;
}

export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="container-page max-w-md py-10"><div className="card p-6 sm:p-8"><h1 className="mb-6 font-display text-2xl font-bold">{title}</h1>{children}</div></div>;
}
