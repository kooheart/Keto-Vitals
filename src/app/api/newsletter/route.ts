import { z } from "zod";
import { route, parseJson } from "@/lib/http";
import { db } from "@/lib/db";
import { emailSchema } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const POST = route(async (req) => {
  rateLimit(`news:${clientIp(req.headers)}`, 8, 60 * 60_000);
  const { email } = await parseJson(req, z.object({ email: emailSchema }));
  await db.subscriber.upsert({ where: { email }, create: { email }, update: {} });
  return { ok: true, message: "Thanks for subscribing!" };
});
