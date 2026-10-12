import { z } from "zod";
import { route, parseJson } from "@/lib/http";
import { addItem, getCartView, removeItem, setQuantity } from "@/lib/cart";
import { currentCart } from "@/lib/cart-session";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const body = z.object({ variantId: z.string().min(1).max(40), quantity: z.number().int().min(0).max(100) });

async function respond(cartId: string, userId?: string, extra: object = {}) {
  return { ...(await getCartView(cartId, userId)), ...extra };
}

/** Add to cart (increments). Price is never accepted from the client. */
export const POST = route(async (req) => {
  rateLimit(`cart:${clientIp(req.headers)}`, 120, 60_000);
  const { variantId, quantity } = await parseJson(req, body.extend({ quantity: z.number().int().min(1).max(100) }));
  const { cart, user } = await currentCart({ create: true });
  const r = await addItem(cart!.id, variantId, quantity);
  return respond(cart!.id, user?.id, { clamped: r.clamped, stock: r.stock });
});

/** Set absolute quantity (0 removes). */
export const PATCH = route(async (req) => {
  const { variantId, quantity } = await parseJson(req, body);
  const { cart, user } = await currentCart({ create: true });
  const r = await setQuantity(cart!.id, variantId, quantity);
  return respond(cart!.id, user?.id, { clamped: r.clamped, stock: r.stock });
});

export const DELETE = route(async (req) => {
  const { variantId } = await parseJson(req, z.object({ variantId: z.string().min(1).max(40) }));
  const { cart, user } = await currentCart({ create: true });
  await removeItem(cart!.id, variantId);
  return respond(cart!.id, user?.id);
});
