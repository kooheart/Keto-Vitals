import { z } from "zod";
import { route, parseJson } from "@/lib/http";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { notFound } from "@/lib/errors";

export const GET = route(async () => {
  const u = await requireUser();
  const w = await db.wishlist.findUnique({ where: { userId: u.id }, include: { items: { select: { productId: true } } } });
  return { productIds: w?.items.map((i) => i.productId) ?? [] };
});

const body = z.object({ productId: z.string().max(40) });

export const POST = route(async (req) => {
  const u = await requireUser();
  const { productId } = await parseJson(req, body);
  if (!(await db.product.findFirst({ where: { id: productId, status: "ACTIVE" }, select: { id: true } }))) throw notFound("Product not found");
  const w = await db.wishlist.upsert({ where: { userId: u.id }, create: { userId: u.id }, update: {} });
  await db.wishlistItem.upsert({ where: { wishlistId_productId: { wishlistId: w.id, productId } }, create: { wishlistId: w.id, productId }, update: {} });
  return { ok: true };
});

export const DELETE = route(async (req) => {
  const u = await requireUser();
  const { productId } = await parseJson(req, body);
  await db.wishlistItem.deleteMany({ where: { productId, wishlist: { userId: u.id } } });
  return { ok: true };
});
