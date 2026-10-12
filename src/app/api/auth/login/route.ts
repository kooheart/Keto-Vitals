import { route, parseJson } from "@/lib/http";
import { loginSchema } from "@/lib/validation";
import { authenticate } from "@/lib/auth/service";
import { createSession } from "@/lib/auth/session";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { afterAuth } from "@/lib/auth/after-auth";

export const POST = route(async (req) => {
  const ip = clientIp(req.headers);
  rateLimit(`login:ip:${ip}`, 30, 15 * 60_000);
  const { email, password } = await parseJson(req, loginSchema);
  rateLimit(`login:email:${email}`, 8, 15 * 60_000); // slow credential stuffing against one account
  const user = await authenticate(email, password);
  await createSession(user.id);
  await afterAuth(user.id);
  return { ok: true };
});
