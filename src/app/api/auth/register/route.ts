import { route, parseJson } from "@/lib/http";
import { registerSchema } from "@/lib/validation";
import { registerUser } from "@/lib/auth/service";
import { createSession } from "@/lib/auth/session";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { afterAuth } from "@/lib/auth/after-auth";

export const POST = route(async (req) => {
  rateLimit(`register:${clientIp(req.headers)}`, 10, 60 * 60_000);
  const input = await parseJson(req, registerSchema);
  const user = await registerUser(input);
  await createSession(user.id);
  await afterAuth(user.id);
  return { ok: true, user: { id: user.id, name: user.name, email: user.email } };
});
