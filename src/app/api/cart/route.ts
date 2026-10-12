import { route } from "@/lib/http";
import { getCartView } from "@/lib/cart";
import { currentCart } from "@/lib/cart-session";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const { cart, user } = await currentCart({ create: false });
  return getCartView(cart?.id ?? null, user?.id);
});
