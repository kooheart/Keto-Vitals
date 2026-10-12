import type { Metadata } from "next";
import { AuthCard, ForgotForm } from "@/components/store/auth-forms";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false } };
export default function Page() { return <AuthCard title="Reset your password"><ForgotForm /></AuthCard>; }
