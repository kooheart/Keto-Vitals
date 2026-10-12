import { z } from "zod";
import { route, parseJson } from "@/lib/http";
import { sendVerificationEmail, verifyEmailToken } from "@/lib/auth/service";
import { requireUser } from "@/lib/auth/session";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/** POST {token} verifies; POST {} resends the verification email to the signed-in user. */
export const POST = route(async (req) => {
  rateLimit(`verify:${clientIp(req.headers)}`, 10, 15 * 60_000);
  const { token } = await parseJson(req, z.object({ token: z.string().max(200).optional() }));
  if (token) {
    await verifyEmailToken(token);
    return { ok: true };
  }
  const u = await requireUser();
  await sendVerificationEmail(u.id, u.email, u.name);
  return { ok: true, message: "Verification email sent." };
});
