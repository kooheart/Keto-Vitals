import "server-only";
import { cookies } from "next/headers";
import { randomToken } from "./auth/password";
import { getCurrentUser } from "./auth/session";
import { getOrCreateCart, findCart, type CartOwner } from "./cart";

export const GUEST_COOKIE = "kv_cart";

/** Resolve (and optionally create) the cart for the current visitor: user cart if signed in, else guest cart. */
export async function currentCart(opts: { create: boolean }) {
  const user = await getCurrentUser();
  if (user) {
    const cart = opts.create ? await getOrCreateCart({ userId: user.id }) : await findCart({ userId: user.id });
    return { cart, user };
  }
  const jar = await cookies();
  let token = jar.get(GUEST_COOKIE)?.value;
  if (!token) {
    if (!opts.create) return { cart: null, user: null };
    token = randomToken(24);
    jar.set(GUEST_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 60 });
  }
  const owner: CartOwner = { guestToken: token };
  return { cart: opts.create ? await getOrCreateCart(owner) : await findCart(owner), user: null };
}
