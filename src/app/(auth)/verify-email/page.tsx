import type { Metadata } from "next";
import { AuthCard, VerifyEmail } from "@/components/store/auth-forms";

export const metadata: Metadata = { title: "Verify email", robots: { index: false } };
// Verification needs an explicit click (POST) so email-scanner link prefetches can't consume the token.
export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <AuthCard title="Verify your email">{token ? <VerifyEmail token={token} /> : <p>This verification link is invalid.</p>}</AuthCard>;
}
