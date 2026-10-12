import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "../db";
import { AppError, forbidden, unauthorized } from "../errors";
import { randomToken, sha256 } from "./password";
import { hasPermission, type Permission } from "./permissions";

export const SESSION_COOKIE = "kv_session";
const SESSION_DAYS = 30;

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  emailVerified: boolean;
  role: string;
  permissions: string[];
};

const cookieOpts = (expires: Date) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  expires,
});

export async function createSession(userId: string) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  const h = await headers();
  await db.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      expiresAt,
      userAgent: h.get("user-agent")?.slice(0, 200),
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim(),
    },
  });
  (await cookies()).set(SESSION_COOKIE, token, cookieOpts(expiresAt));
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Resolve the signed-in user from the cookie (cached per request). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { include: { role: true } } },
  });
  if (!s || s.expiresAt < new Date() || s.user.disabledAt) return null;
  const u = s.user;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    phone: u.phone,
    emailVerified: !!u.emailVerifiedAt,
    role: u.role.name,
    permissions: u.role.permissions,
  };
});

/** For route handlers / server actions: throws AppError. */
export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) throw unauthorized();
  return u;
}

export async function requirePermission(p: Permission): Promise<CurrentUser> {
  const u = await requireUser();
  if (!hasPermission(u.permissions, p)) throw forbidden();
  return u;
}

/** For pages: redirects instead of throwing. */
export async function requireUserPage(next?: string): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return u;
}

export async function requireAdminPage(p: Permission = "dashboard.view"): Promise<CurrentUser> {
  const u = await requireUserPage("/admin");
  if (!hasPermission(u.permissions, p)) redirect("/?denied=1");
  return u;
}

export { AppError };
