import type { Metadata } from "next";
import { AuthCard, ResetForm } from "@/components/store/auth-forms";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <AuthCard title="Choose a new password">{token ? <ResetForm token={token} /> : <p>This reset link is invalid. Please request a new one.</p>}</AuthCard>;
}
