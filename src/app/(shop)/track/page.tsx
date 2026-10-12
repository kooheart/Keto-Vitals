import type { Metadata } from "next";
import Link from "next/link";
import { TrackForm } from "@/components/store/track-form";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Track your order", robots: { index: false } };

export default async function TrackPage() {
  const user = await getCurrentUser();
  return (
    <div className="container-page max-w-md py-10">
      <h1 className="font-display text-3xl font-bold">Track your order</h1>
      <p className="mt-2 text-sm text-ink-600">Enter your order number and email. {user ? <>Or <Link href="/account/orders" className="font-semibold text-brand-700 underline">view all your orders</Link>.</> : <>Or <Link href="/login?next=/account/orders" className="font-semibold text-brand-700 underline">sign in</Link> to see all orders.</>}</p>
      <TrackForm />
    </div>
  );
}
