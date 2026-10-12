import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUserPage } from "@/lib/auth/session";
import { AddressManager } from "@/components/store/account-forms";

export const metadata: Metadata = { title: "Saved addresses", robots: { index: false } };

export default async function Page() {
  const u = await requireUserPage("/account");
  const addresses = await db.address.findMany({ where: { userId: u.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] });
  return <div><h1 className="mb-5 font-display text-2xl font-bold">Saved addresses</h1><AddressManager addresses={addresses} /></div>;
}
