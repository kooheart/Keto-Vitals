import { z } from "zod";
import { route, parseJson } from "@/lib/http";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { phoneSchema } from "@/lib/validation";

export const PATCH = route(async (req) => {
  const u = await requireUser();
  const { name, phone } = await parseJson(req, z.object({ name: z.string().trim().min(2).max(80), phone: phoneSchema.optional().or(z.literal("").transform(() => undefined)) }));
  await db.user.update({ where: { id: u.id }, data: { name, phone: phone ?? null } });
  return { ok: true };
});
