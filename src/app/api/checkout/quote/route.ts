import { NextRequest } from "next/server";
import { route } from "@/lib/http";
import { loadLines, priceLines } from "@/lib/cart";
import { currentCart } from "@/lib/cart-session";
import { checkPincode } from "@/lib/shipping";
import { isRazorpayConfigured } from "@/lib/razorpay";

export const dynamic = "force-dynamic";

/** Authoritative totals for the checkout summary: zone shipping, COD fee, coupon and GST. */
export const GET = route(async (req: NextRequest) => {
  const pin = req.nextUrl.searchParams.get("pin") ?? "";
  const cod = req.nextUrl.searchParams.get("cod") === "1";
  const { cart, user } = await currentCart({ create: false });
  const lines = cart ? await loadLines(cart.id) : [];
  const svc = pin ? await checkPincode(pin) : null;
  const { pricing, coupon, settings } = await priceLines(lines, { couponCode: cart?.couponCode, userId: user?.id, email: user?.email, shippingRatePaise: svc?.serviceable ? svc.ratePaise : undefined, cod: cod && !!svc?.serviceable && svc.codAvailable });
  const codAllowed = settings["cod.enabled"] && !!svc?.serviceable && svc.codAvailable;
  return {
    pricing, service: svc && (svc.serviceable ? { ...svc } : svc),
    coupon: coupon?.ok ? { code: coupon.coupon.code } : null,
    methods: {
      razorpay: settings["payments.razorpay.enabled"] && isRazorpayConfigured(),
      cod: codAllowed && pricing.totalPaise <= settings["cod.maxOrderPaise"],
      codFeePaise: settings["cod.feePaise"], codMaxPaise: settings["cod.maxOrderPaise"],
    },
  };
});
