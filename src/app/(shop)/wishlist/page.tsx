import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { cardSelect } from "@/lib/catalog";
import { requireUserPage } from "@/lib/auth/session";
import { ProductGrid } from "@/components/store/product-card";

export const metadata: Metadata = { title: "My wishlist", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const u = await requireUserPage("/wishlist");
  const items = await db.product.findMany({ where: { status: "ACTIVE", wishlistedBy: { some: { wishlist: { userId: u.id } } } }, select: cardSelect, orderBy: { updatedAt: "desc" } });
  return (
    <div className="container-page py-8">
      <h1 className="font-display text-3xl font-bold">My wishlist</h1>
      {items.length === 0 ? <div className="py-16 text-center"><p className="text-ink-600">Nothing saved yet. Tap the heart on any product to save it here.</p><Link href="/search" className="btn-primary mt-5">Browse products</Link></div> : <div className="mt-6"><ProductGrid items={items} wishlist={new Set(items.map((i) => i.id))} /></div>}
    </div>
  );
}
