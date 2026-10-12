"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { CartView } from "@/lib/cart";
import { api, ApiFail } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

type CartCtx = {
  cart: CartView | null;
  loading: boolean;
  count: number;
  add: (variantId: string, quantity: number, name?: string) => Promise<boolean>;
  setQty: (variantId: string, quantity: number) => Promise<void>;
  remove: (variantId: string) => Promise<void>;
  applyCoupon: (code: string) => Promise<string | null>;
  removeCoupon: () => Promise<void>;
  refresh: () => Promise<void>;
};
const Ctx = createContext<CartCtx | null>(null);
export const useCart = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart outside CartProvider");
  return c;
};

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartView | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const refresh = useCallback(async () => {
    try { setCart(await api<CartView>("/api/cart", "GET")); } catch { /* keep previous */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const mutate = useCallback(async (fn: () => Promise<CartView & { clamped?: boolean; stock?: number }>, okMsg?: string) => {
    try {
      const next = await fn();
      setCart(next);
      if (next.clamped) toast({ kind: "error", message: `Only ${next.stock} available — we've adjusted the quantity.` });
      else if (okMsg) toast({ kind: "success", message: okMsg, action: { label: "View cart", href: "/cart" } });
      return true;
    } catch (e) {
      toast({ kind: "error", message: e instanceof ApiFail ? e.message : "Could not update your cart." });
      return false;
    }
  }, [toast]);

  const value: CartCtx = {
    cart, loading, count: cart?.itemCount ?? 0, refresh,
    add: (variantId, quantity, name) => mutate(() => api("/api/cart/items", "POST", { variantId, quantity }), `${name ?? "Item"} added to your cart`),
    setQty: async (variantId, quantity) => { await mutate(() => api("/api/cart/items", "PATCH", { variantId, quantity })); },
    remove: async (variantId) => { await mutate(() => api("/api/cart/items", "DELETE", { variantId }), undefined); },
    applyCoupon: async (code) => {
      try { setCart(await api<CartView>("/api/cart/coupon", "POST", { code })); return null; }
      catch (e) { return e instanceof ApiFail ? e.message : "Could not apply coupon."; }
    },
    removeCoupon: async () => { setCart(await api<CartView>("/api/cart/coupon", "DELETE")); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
