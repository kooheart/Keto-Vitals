import "server-only";
import { db } from "./db";
import { getCurrentUser } from "./auth/session";

export async function getWishlistIds(): Promise<Set<string>> {
  const u = await getCurrentUser();
  if (!u) return new Set();
  const items = await db.wishlistItem.findMany({ where: { wishlist: { userId: u.id } }, select: { productId: true } });
  return new Set(items.map((i) => i.productId));
}
