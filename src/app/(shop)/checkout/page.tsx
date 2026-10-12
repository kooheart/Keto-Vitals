import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { CheckoutForm } from "@/components/store/checkout-form";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const user = await getCurrentUser();
  const saved = user ? await db.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }], select: { id: true, fullName: true, phone: true, line1: true, line2: true, landmark: true, city: true, state: true, pincode: true } }) : [];
  return <CheckoutForm user={user ? { email: user.email, name: user.name, phone: user.phone } : null} saved={saved} />;
}
