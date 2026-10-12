import { z } from "zod";
import { route, parseJson } from "@/lib/http";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { addressSchema } from "@/lib/validation";
import { badRequest, notFound } from "@/lib/errors";

export const GET = route(async () => {
  const u = await requireUser();
  return { addresses: await db.address.findMany({ where: { userId: u.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] }) };
});

export const POST = route(async (req) => {
  const u = await requireUser();
  const a = await parseJson(req, addressSchema);
  if ((await db.address.count({ where: { userId: u.id } })) >= 10) throw badRequest("You can save up to 10 addresses.");
  const first = (await db.address.count({ where: { userId: u.id } })) === 0;
  const isDefault = a.isDefault || first;
  if (isDefault) await db.address.updateMany({ where: { userId: u.id }, data: { isDefault: false } });
  return { address: await db.address.create({ data: { ...a, isDefault, userId: u.id } }) };
});

export const PUT = route(async (req) => {
  const u = await requireUser();
  const { id, ...rest } = await parseJson(req, addressSchema.extend({ id: z.string().max(40) }));
  const own = await db.address.findFirst({ where: { id, userId: u.id } }); // ownership check: no IDOR
  if (!own) throw notFound();
  if (rest.isDefault) await db.address.updateMany({ where: { userId: u.id }, data: { isDefault: false } });
  return { address: await db.address.update({ where: { id }, data: rest }) };
});

export const DELETE = route(async (req) => {
  const u = await requireUser();
  const { id } = await parseJson(req, z.object({ id: z.string().max(40) }));
  await db.address.deleteMany({ where: { id, userId: u.id } });
  return { ok: true };
});
