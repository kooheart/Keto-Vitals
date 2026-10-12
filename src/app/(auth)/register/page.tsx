import type { Metadata } from "next";
import { AuthCard, RegisterForm } from "@/components/store/auth-forms";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return <AuthCard title="Create your account"><RegisterForm next={(await searchParams).next} /></AuthCard>;
}
