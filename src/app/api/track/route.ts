import { z } from "zod";
import { route, parseJson } from "@/lib/http";
import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { emailSchema } from "@/lib/validation";
import { orderAccessToken } from "@/lib/order-access";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/** Guest tracking: order number + matching email → signed link. Rate-limited against enumeration. */
export const POST = route(async (req) => {
  rateLimit(`track:${clientIp(req.headers)}`, 10, 15 * 60_000);
  const { number, email } = await parseJson(req, z.object({ number: z.string().trim().toUpperCase().min(6).max(30), email: emailSchema }));
  const o = await db.order.findUnique({ where: { number }, select: { number: true, email: true } });
  if (!o || o.email !== email) throw notFound("We couldn’t find an order with those details.");
  return { url: `/order/${o.number}?t=${orderAccessToken(o.number)}` };
});
