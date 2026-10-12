import { z } from "zod";
import { route, parseJson } from "@/lib/http";
import { db } from "@/lib/db";
import { badRequest } from "@/lib/errors";
import { placeOrder } from "@/lib/orders";
import { currentCart } from "@/lib/cart-session";
import { addressSchema, emailSchema, phoneSchema } from "@/lib/validation";
import { orderAccessToken } from "@/lib/order-access";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const schema = z.object({
  idempotencyKey: z.string().min(16).max(64).regex(/^[A-Za-z0-9_-]+$/),
  email: emailSchema,
  phone: phoneSchema,
  address: addressSchema,
  paymentMethod: z.enum(["RAZORPAY", "COD"]),
  note: z.string().max(500).optional(),
  saveAddress: z.boolean().optional(),
});

export const POST = route(async (req) => {
  rateLimit(`place:${clientIp(req.headers)}`, 20, 10 * 60_000);
  const input = await parseJson(req, schema);
  const { cart, user } = await currentCart({ create: false });
  if (!cart) throw badRequest("Your cart is empty.", "empty_cart");
  // Price, stock and coupon are all re-derived server-side from the cart + database.
  const res = await placeOrder({ ...input, cartId: cart.id, userId: user?.id, couponCode: cart.couponCode });
  if (user && input.saveAddress && !res.duplicate) {
    const count = await db.address.count({ where: { userId: user.id } });
    if (count < 10) await db.address.create({ data: { ...input.address, phone: input.address.phone, userId: user.id, isDefault: count === 0 } });
  }
  return { orderId: res.order.id, number: res.order.number, token: orderAccessToken(res.order.number), status: res.order.status, duplicate: res.duplicate, razorpay: res.razorpay };
});
