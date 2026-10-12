import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard, LoginForm } from "@/components/store/auth-forms";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const sp = await searchParams;
  if (await getCurrentUser()) redirect(sp.next?.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/account");
  return <AuthCard title="Sign in">{sp.reset && <p role="status" className="mb-4 rounded-lg bg-brand-50 p-3 text-sm text-brand-900">Password updated. Please sign in.</p>}<LoginForm next={sp.next} /></AuthCard>;
}
