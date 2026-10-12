import { z } from "zod";
import { route, parseJson } from "@/lib/http";
import { db } from "@/lib/db";
import { badRequest } from "@/lib/errors";
import { getCartView, loadLines } from "@/lib/cart";
import { currentCart } from "@/lib/cart-session";
import { normalizeCoupon, resolveCoupon } from "@/lib/coupons";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const POST = route(async (req) => {
  rateLimit(`coupon:${clientIp(req.headers)}`, 20, 10 * 60_000); // stops code guessing
  const { code } = await parseJson(req, z.object({ code: z.string().trim().min(1).max(40) }));
  const { cart, user } = await currentCart({ create: true });
  const lines = await loadLines(cart!.id);
  const subtotal = lines.reduce((a, l) => a + l.lineTotalPaise, 0);
  const r = await resolveCoupon(code, { subtotalPaise: subtotal, userId: user?.id, email: user?.email });
  if (!r.ok) throw badRequest(r.reason, "coupon_invalid");
  await db.cart.update({ where: { id: cart!.id }, data: { couponCode: normalizeCoupon(code) } });
  return getCartView(cart!.id, user?.id);
});

export const DELETE = route(async () => {
  const { cart, user } = await currentCart({ create: false });
  if (cart) await db.cart.update({ where: { id: cart.id }, data: { couponCode: null } });
  return getCartView(cart?.id ?? null, user?.id);
});
