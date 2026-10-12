import crypto from "node:crypto";

/** Signed link token so guests can open their own order page without an account. */
export function orderAccessToken(number: string): string {
  return crypto.createHmac("sha256", process.env.APP_SECRET ?? "dev").update(`order:${number}`).digest("hex").slice(0, 32);
}
export function validOrderToken(number: string, token?: string | null): boolean {
  if (!token) return false;
  const a = Buffer.from(orderAccessToken(number));
  const b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
