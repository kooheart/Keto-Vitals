import { z } from "zod";
import { route, parseJson } from "@/lib/http";
import { retryPayment } from "@/lib/orders";
import { getCurrentUser } from "@/lib/auth/session";
import { emailSchema } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const POST = route(async (req) => {
  rateLimit(`retry:${clientIp(req.headers)}`, 15, 10 * 60_000);
  const { orderId, email } = await parseJson(req, z.object({ orderId: z.string().max(40), email: emailSchema.optional() }));
  const user = await getCurrentUser();
  return retryPayment(orderId, { userId: user?.id, email: email ?? user?.email });
});
