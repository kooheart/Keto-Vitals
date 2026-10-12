import { z } from "zod";
import { route, parseJson } from "@/lib/http";
import { emailSchema } from "@/lib/validation";
import { requestPasswordReset } from "@/lib/auth/service";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const POST = route(async (req) => {
  rateLimit(`forgot:${clientIp(req.headers)}`, 5, 15 * 60_000);
  const { email } = await parseJson(req, z.object({ email: emailSchema }));
  await requestPasswordReset(email);
  // Same response whether or not the account exists.
  return { ok: true, message: "If an account exists for that email, a reset link is on its way." };
});
