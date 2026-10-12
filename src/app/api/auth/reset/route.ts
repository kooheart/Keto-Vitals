import { z } from "zod";
import { route, parseJson } from "@/lib/http";
import { passwordSchema } from "@/lib/validation";
import { resetPassword } from "@/lib/auth/service";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const POST = route(async (req) => {
  rateLimit(`reset:${clientIp(req.headers)}`, 10, 15 * 60_000);
  const { token, password } = await parseJson(req, z.object({ token: z.string().min(10).max(200), password: passwordSchema }));
  await resetPassword(token, password);
  return { ok: true };
});
