import { z } from "zod";
import { route, parseJson } from "@/lib/http";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { reviewSchema } from "@/lib/validation";
import { notFound } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";

/** One review per customer per product. "Verified purchase" is derived from real delivered orders only. */
export const POST = route(async (req) => {
  const u = await requireUser();
  rateLimit(`review:${u.id}`, 10, 60 * 60_000);
  const input = await parseJson(req, reviewSchema.extend({ productId: z.string().max(40) }));
  if (!(await db.product.findFirst({ where: { id: input.productId, status: "ACTIVE" }, select: { id: true } }))) throw notFound("Product not found");
  const verified = !!(await db.orderItem.findFirst({ where: { productId: input.productId, order: { userId: u.id, status: "DELIVERED" } }, select: { id: true } }));
  const data = { rating: input.rating, title: input.title || null, body: input.body, verifiedPurchase: verified, status: "PENDING" as const };
  await db.review.upsert({ where: { productId_userId: { productId: input.productId, userId: u.id } }, create: { productId: input.productId, userId: u.id, ...data }, update: data });
  return { ok: true, message: "Thanks! Your review will appear after moderation." };
});
