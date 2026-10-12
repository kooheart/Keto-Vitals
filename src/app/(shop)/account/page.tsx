import type { Metadata } from "next";
import { requireUserPage } from "@/lib/auth/session";
import { PasswordForm, ProfileForm, ResendVerify } from "@/components/store/account-forms";

export const metadata: Metadata = { title: "My account", robots: { index: false } };

export default async function AccountPage() {
  const u = await requireUserPage("/account");
  return (
    <div className="max-w-xl space-y-10">
      <section><h1 className="font-display text-2xl font-bold">Profile</h1>
        <p className="mt-1 text-sm text-ink-600">{u.email} · {u.emailVerified ? <span className="chip">Verified</span> : <span className="inline-flex items-center gap-2">Not verified <ResendVerify /></span>}</p>
        <div className="mt-5"><ProfileForm name={u.name} phone={u.phone ?? ""} /></div></section>
      <section><h2 className="font-display text-xl font-bold">Security</h2><p className="mb-4 mt-1 text-sm text-ink-600">Changing your password signs you out of other devices.</p><PasswordForm /></section>
    </div>
  );
}
