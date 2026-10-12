import { z } from "zod";
import { cookies } from "next/headers";
import { route, parseJson } from "@/lib/http";
import { passwordSchema } from "@/lib/validation";
import { changePassword } from "@/lib/auth/service";
import { requireUser, SESSION_COOKIE } from "@/lib/auth/session";
import { sha256 } from "@/lib/auth/password";
import { rateLimit } from "@/lib/rate-limit";

export const POST = route(async (req) => {
  const u = await requireUser();
  rateLimit(`pw:${u.id}`, 5, 15 * 60_000);
  const { current, next } = await parseJson(req, z.object({ current: z.string().max(128), next: passwordSchema }));
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  await changePassword(u.id, current, next, token ? sha256(token) : undefined); // other devices are signed out
  return { ok: true };
});
