import Link from "next/link";
import { requireUserPage } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireUserPage("/account");
  const link = "block rounded-lg px-3 py-2 text-sm font-medium hover:bg-ink-100";
  return (
    <div className="container-page grid gap-8 py-8 md:grid-cols-4">
      <nav aria-label="Account" className="md:col-span-1"><ul className="flex gap-1 overflow-x-auto md:block"><li><Link className={link} href="/account">Profile & security</Link></li><li><Link className={link} href="/account/orders">Orders</Link></li><li><Link className={link} href="/account/addresses">Addresses</Link></li><li><Link className={link} href="/wishlist">Wishlist</Link></li></ul></nav>
      <div className="md:col-span-3">{children}</div>
    </div>
  );
}
