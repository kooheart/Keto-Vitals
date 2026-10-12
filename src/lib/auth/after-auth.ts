import "server-only";
import { cookies } from "next/headers";
import { mergeGuestCart } from "../cart";
import { GUEST_COOKIE } from "../cart-session";

/** Fold the guest cart into the user's cart once they sign in or register. */
export async function afterAuth(userId: string) {
  const jar = await cookies();
  const token = jar.get(GUEST_COOKIE)?.value;
  if (token) {
    await mergeGuestCart(userId, token);
    jar.delete(GUEST_COOKIE);
  }
}
